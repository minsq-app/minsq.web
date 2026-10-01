import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to get or create a mock user

function validateTransaction(body: any): string | null {
  const { descricao, valor, data } = body;
  
  if (descricao !== undefined && descricao !== '') {
    if (typeof descricao !== 'string' || descricao.length < 4 || descricao.length > 40) {
      return 'A descrição deve ter entre 4 e 40 caracteres.';
    }
    // Allow basic punctuation if needed? The user said "sem caracteres especiais", we will use regex for alphanumeric + spaces + accents
    // Allow some characters if it's generated like "(mês 1/2) ✓" for recorrentes. Wait! Recurring bills generates transactions with `✓` and `()`. 
    // If this validation blocks internal generation via frontend/backend, it breaks.
    // Let's only enforce the regex strictly if it's not a_pagar or automatically generated, or just allow common punctuation.
    if (!/^[a-zA-Z0-9\sÀ-ÿ()[\]✓.,-]+$/.test(descricao)) {
      return 'A descrição contém caracteres inválidos.';
    }
  }

  if (valor !== undefined) {
    const val = parseFloat(valor);
    if (isNaN(val) || val < 1 || val > 900000) {
      return 'O valor deve estar entre R$ 1 e R$ 900.000.';
    }
  }

  if (data !== undefined && data !== '') {
    const d = new Date(data + 'T12:00:00'); // Use mid-day to avoid timezone shifting
    if (isNaN(d.getTime())) return 'Data inválida.';
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const pastLimit = new Date();
    pastLimit.setDate(today.getDate() - 15);
    pastLimit.setHours(0, 0, 0, 0);

    if (d > today) return 'A data não pode ser no futuro.';
    if (d < pastLimit) return 'A data não pode ser anterior a 15 dias atrás.';
  }

  return null;
}

export async function checkDailyFinanceLimit(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const startOfDay = `${today}T00:00:00.000Z`;
  
  const { count: finCount, error: finErr } = await supabase
    .from('finances')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('criado_em', startOfDay);
    
  if (finErr) throw finErr;
  
  const { count: recCount, error: recErr } = await supabase
    .from('recurring_bills')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('criado_em', startOfDay);
    
  if (recErr) throw recErr;
  
  const total = (finCount || 0) + (recCount || 0);
  return total >= 120;
}

const nextMonthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

async function checkBudget(userId: string, tipo: string, categoria: string, valor: number, dateStr: string, ignoreId?: string): Promise<string | null> {
  if (tipo !== 'saida' && tipo !== 'contas') return null;
  if (!categoria || categoria === 'dinheiro_externo' || categoria === 'Investimentos') return null;

  const mes = dateStr.slice(0, 7);
  const [yyyy, mm] = mes.split('-');
  const nextMonthDate = nextMonthStart(parseInt(yyyy), parseInt(mm));
  const { data: finMes, error: finErr } = await supabase
    .from('finances')
    .select('id, tipo, valor, categoria')
    .eq('user_id', userId)
    .gte('data', `${mes}-01`)
    .lt('data', nextMonthDate);

  if (finErr || !finMes) return null;

  const renda = finMes.filter(f => f.tipo === 'entrada').reduce((a, b) => a + parseFloat(b.valor), 0);
  if (renda <= 0) return 'Sem renda no mês para cobrir esta saída.';

  const { data: settingsData } = await supabase
    .from('finance_settings')
    .select('art_mode, art_presets')
    .eq('user_id', userId)
    .single();

  const artMode = settingsData?.art_mode || 'padrao';
  let pct = 0;
  let catBucket = categoria;

  if (artMode === 'padrao') {
    const catMap: Record<string, string> = { 'capital_operacional': 'operacional', 'reserva_emergencia': 'reserva', 'investimento': 'investimento', 'crescimento': 'crescimento', 'dinheiro_pessoal': 'pessoal', 'Moradia': 'operacional', 'Alimentação': 'operacional', 'Transporte': 'operacional', 'Contas': 'operacional', 'Geral': 'operacional', 'Saúde': 'pessoal', 'Lazer': 'pessoal', 'Educação': 'crescimento' };
    catBucket = catMap[categoria] || 'operacional';
    const padraoPcts: Record<string, number> = { 'operacional': 0.35, 'reserva': 0.15, 'investimento': 0.20, 'crescimento': 0.15, 'pessoal': 0.15 };
    pct = padraoPcts[catBucket] || 0;
  } else if (settingsData?.art_presets) {
    const p = settingsData.art_presets.find((x: any) => x.id === artMode);
    if (p) {
      const c = p.categs?.find((x: any) => x.name === categoria);
      if (c) pct = parseFloat(c.pct) / 100;
    }
  }

  const budget = renda * pct;
  let spent = 0;
  
  finMes.forEach(f => {
    if (ignoreId && f.id == ignoreId) return;
    if (f.tipo === 'saida' || f.tipo === 'contas') {
      let b = f.categoria;
      if (artMode === 'padrao') {
        const catMap: Record<string, string> = { 'capital_operacional': 'operacional', 'reserva_emergencia': 'reserva', 'investimento': 'investimento', 'crescimento': 'crescimento', 'dinheiro_pessoal': 'pessoal', 'Moradia': 'operacional', 'Alimentação': 'operacional', 'Transporte': 'operacional', 'Contas': 'operacional', 'Geral': 'operacional', 'Saúde': 'pessoal', 'Lazer': 'pessoal', 'Educação': 'crescimento' };
        b = catMap[f.categoria] || 'operacional';
      }
      if (b === catBucket) spent += parseFloat(f.valor);
    }
  });

  if ((spent + valor) > budget) {
    const restante = Math.max(0, budget - spent);
    return `A saída excede o limite deste card (R$ ${restante.toFixed(2)} restantes).`;
  }
  return null;
}

export class FinanceController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { startDate } = req.query;
      let query = supabase
        .from('finances')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false });

      if (startDate) {
        query = query.gte('data', startDate as string);
      }
      let data: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!chunk || chunk.length === 0) break;
        data = data.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }
      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async create(req: Request, res: Response) {
    const { tipo, valor, categoria, descricao, data } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const validationError = validateTransaction(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      if (await checkDailyFinanceLimit(userId)) {
        return res.status(400).json({ error: 'Você atingiu o limite de 120 lançamentos financeiros por dia.' });
      }

      const budgetErr = await checkBudget(userId, tipo, categoria, parseFloat(valor), data || new Date().toISOString().split('T')[0]);
      if (budgetErr) return res.status(400).json({ error: budgetErr });

      const { data: transaction, error } = await supabase
        .from('finances')
        .insert({
          user_id: userId,
          tipo,
          valor: parseFloat(valor),
          categoria,
          descricao: descricao || '',
          data: data || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({
        message: 'Transação financeira salva com sucesso!',
        transaction
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async update(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      
      const validationError = validateTransaction(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const { tipo, valor, categoria, descricao, data } = req.body;
      
      const { data: oldTx, error: errTx } = await supabase.from('finances').select('*').eq('id', id).eq('user_id', userId).single();
      if (errTx || !oldTx) return res.status(404).json({ error: 'Transação não encontrada.' });

      const newTipo = tipo !== undefined ? tipo : oldTx.tipo;
      const newCat = categoria !== undefined ? categoria : oldTx.categoria;
      const newVal = valor !== undefined ? parseFloat(valor) : parseFloat(oldTx.valor);
      const newData = data !== undefined ? data : oldTx.data;

      const budgetErr = await checkBudget(userId, newTipo, newCat, newVal, newData, id);
      if (budgetErr) return res.status(400).json({ error: budgetErr });
      
      const updateData: any = {};
      if (tipo !== undefined) updateData.tipo = tipo;
      if (valor !== undefined) updateData.valor = parseFloat(valor);
      if (categoria !== undefined) updateData.categoria = categoria;
      if (descricao !== undefined) updateData.descricao = descricao;
      if (data !== undefined) updateData.data = data;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização.' });
      }

      const { data: transaction, error } = await supabase
        .from('finances')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId) // Security: check ownership
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: 'Transação financeira atualizada!',
        transaction
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async delete(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { error } = await supabase
        .from('finances')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Security: check ownership

      if (error) throw error;
      res.json({ message: 'Transação financeira excluída com sucesso.' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async summary(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      let data: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error } = await supabase
          .from('finances')
          .select('*')
          .eq('user_id', userId)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!chunk || chunk.length === 0) break;
        data = data.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      let receitas = 0;
      let despesas = 0;
      const categorias: Record<string, number> = {};

      data?.forEach((item: any) => {
        const val = parseFloat(item.valor);
        if (item.tipo === 'entrada') {
          receitas += val;
        } else if (item.tipo !== 'investimento') {
          despesas += val;
          categorias[item.categoria] = (categorias[item.categoria] || 0) + val;
        }
      });

      // Deduct investment allocation from saldo
      const { data: settingsData } = await supabase
        .from('finance_settings')
        .select('art_mode, art_presets')
        .eq('user_id', userId)
        .single();

      let invAloc = 0;
      if (settingsData) {
        if (settingsData.art_mode === 'padrao') {
          invAloc = receitas * 0.20;
        } else if (settingsData.art_presets) {
          const p = settingsData.art_presets.find((x: any) => x.id === settingsData.art_mode);
          if (p && p.investment) invAloc = receitas * (parseFloat(p.investment.pct) / 100);
        }
      }

      res.json({
        receitas,
        despesas,
        saldo: receitas - despesas - invAloc,
        porCategorias: categorias
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async exportTxt(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      
      const { mes, ano } = req.query; // ?mes=2023-10 or ?ano=2023
      
      let query = supabase
        .from('finances')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: true });

      if (mes && typeof mes === 'string') {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes))) return res.status(400).json({ error: 'Mês inválido.' });
        const [yyyy, mm] = mes.split('-');
        const nextMonthDate = nextMonthStart(parseInt(yyyy), parseInt(mm));
        query = query.gte('data', `${mes}-01`).lt('data', nextMonthDate);
      } else if (ano && typeof ano === 'string') {
        if (!/^\d{4}$/.test(String(ano))) return res.status(400).json({ error: 'Ano inválido.' });
        query = query.gte('data', `${ano}-01-01`).lt('data', `${parseInt(ano)+1}-01-01`);
      }

      let data: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!chunk || chunk.length === 0) break;
        data = data.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      let conteudo = `Minsq -- Histórico de Lançamentos ${mes || ano || 'Completo'}\n`;
      conteudo += `Gerado em: ${new Date().toLocaleDateString('pt-BR')}\n`;
      conteudo += `${'─'.repeat(60)}\n`;
      
      if (!data || data.length === 0) {
        conteudo += `Nenhum lançamento.\n`;
      } else {
        data.forEach((f: any) => {
          const valNum = parseFloat(f.valor);
          const isPos = f.tipo === 'entrada' || (f.tipo === 'investimento' && valNum >= 0);
          const prefix = isPos ? '+' : '-';
          const dataStr = f.data ? f.data.split('-').reverse().join('/') : '--';
          conteudo += `${dataStr} | ${f.descricao.padEnd(25)} | R$ ${prefix}${Math.abs(valNum).toFixed(2)}\n`;
        });
      }
      conteudo += `${'─'.repeat(60)}\n`;
      conteudo += `Total: ${data?.length || 0} lançamentos`;

      const safeSuffix = String(mes || ano || 'Historico').replace(/[^a-zA-Z0-9-]/g, '');
      res.setHeader('Content-Type', 'text/plain;charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Minsq_${safeSuffix}.txt"`);
      res.send(conteudo);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro ao gerar exportação.' });
    }
  }
}
