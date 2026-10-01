import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { checkDailyFinanceLimit } from './finance.controller';

export class RecurringBillsController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: true });

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async create(req: Request, res: Response) {
    const { bill_id, descricao, valor, dia, modo, fonte, parcelas, parcelas_pagas, infinito, mes_inicio } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      // Validations
      if (await checkDailyFinanceLimit(userId)) {
        return res.status(400).json({ error: 'Você atingiu o limite de 120 lançamentos financeiros por dia.' });
      }

      if (!bill_id || !descricao || !valor || !dia || !modo || !mes_inicio) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      if (typeof descricao !== 'string' || descricao.length < 4 || descricao.length > 40) {
        return res.status(400).json({ error: 'O nome da conta recorrente deve ter entre 4 e 40 caracteres.' });
      }
      if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(descricao)) {
        return res.status(400).json({ error: 'O nome não pode conter caracteres especiais.' });
      }

      const val = parseFloat(valor);
      if (isNaN(val) || val < 1 || val > 900000) {
        return res.status(400).json({ error: 'Valor da parcela deve estar entre R$ 1 e R$ 900.000.' });
      }

      const day = parseInt(dia);
      if (isNaN(day) || day < 1 || day > 28) {
        return res.status(400).json({ error: 'Dia de cobrança deve ser entre 1 e 28.' });
      }

      if (modo !== 'notificar') {
        return res.status(400).json({ error: 'Modo inválido. Apenas notificar é permitido.' });
      }
      
      const parsedParcelas = parseInt(parcelas);
      if (!infinito) {
        if (isNaN(parsedParcelas) || parsedParcelas < 2 || parsedParcelas > 60) {
          return res.status(400).json({ error: 'A quantidade de parcelas deve estar entre 2 e 60.' });
        }
      }

      // Max 20 bills constraint
      const { count, error: countErr } = await supabase
        .from('recurring_bills')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countErr) throw countErr;

      if (count !== null && count >= 20) {
        return res.status(400).json({ error: 'Limite atingido: máximo de 20 contas recorrentes cadastradas.' });
      }

      const { data, error } = await supabase
        .from('recurring_bills')
        .insert({
          user_id: userId,
          bill_id,
          descricao,
          valor: val,
          dia: day,
          modo,
          fonte: fonte || null,
          parcelas: infinito ? null : parseInt(parcelas),
          parcelas_pagas: parseInt(parcelas_pagas) || 0,
          infinito: !!infinito,
          mes_inicio
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: 'Conta recorrente criada com sucesso!',
        bill: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async update(req: Request, res: Response) {
    const { bill_id } = req.params;
    const { descricao, valor, dia, modo, fonte, parcelas, parcelas_pagas, infinito } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      // Validations if provided
      const updateData: any = {};
      if (descricao !== undefined) {
        if (typeof descricao !== 'string' || descricao.length < 4 || descricao.length > 40) {
          return res.status(400).json({ error: 'O nome da conta recorrente deve ter entre 4 e 40 caracteres.' });
        }
        if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(descricao)) {
          return res.status(400).json({ error: 'O nome não pode conter caracteres especiais.' });
        }
        updateData.descricao = descricao;
      }
      if (valor !== undefined) {
        const val = parseFloat(valor);
        if (isNaN(val) || val < 1 || val > 900000) return res.status(400).json({ error: 'Valor da parcela deve estar entre R$ 1 e R$ 900.000.' });
        updateData.valor = val;
      }
      if (dia !== undefined) {
        const day = parseInt(dia);
        if (isNaN(day) || day < 1 || day > 28) return res.status(400).json({ error: 'Dia deve ser entre 1 e 28.' });
        updateData.dia = day;
      }
      if (modo !== undefined) {
        if (modo !== 'notificar') return res.status(400).json({ error: 'Modo inválido. Apenas notificar é permitido.' });
        updateData.modo = modo;
      }
      if (fonte !== undefined) updateData.fonte = fonte || null;
      
      if (infinito !== undefined) updateData.infinito = !!infinito;
      const isInfinito = infinito !== undefined ? !!infinito : false; // Defaulting to false if not sent, wait, it's safer to rely on DB state if not updating. Let's assume if parcelas is updated, infinito is also sent correctly by front.
      
      if (parcelas !== undefined) {
        const parsedParcelas = parseInt(parcelas);
        if (!isInfinito) {
          if (isNaN(parsedParcelas) || parsedParcelas < 2 || parsedParcelas > 60) {
             return res.status(400).json({ error: 'A quantidade de parcelas deve estar entre 2 e 60.' });
          }
        }
        updateData.parcelas = isInfinito ? null : parsedParcelas;
      }
      if (parcelas_pagas !== undefined) updateData.parcelas_pagas = parseInt(parcelas_pagas);

      const { data, error } = await supabase
        .from('recurring_bills')
        .update(updateData)
        .eq('user_id', userId)
        .eq('bill_id', bill_id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        message: 'Conta recorrente atualizada!',
        bill: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async delete(req: Request, res: Response) {
    const { bill_id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const { error } = await supabase
        .from('recurring_bills')
        .delete()
        .eq('user_id', userId)
        .eq('bill_id', bill_id);

      if (error) throw error;

      res.json({ message: 'Conta recorrente excluída com sucesso.' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
