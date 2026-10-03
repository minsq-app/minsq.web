import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Hora HH:MM válida (00:00–23:59): minutos só de 00 a 59.
const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;


// Helper to get or create a mock user

export class TasksController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { startDate } = req.query;
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: true })
        .order('criado_em', { ascending: true });

      if (startDate) {
        query = query.gte('data', startDate as string);
      }
      query = query.limit(2000);
      const { data, error } = await query;

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async create(req: Request, res: Response) {
    const { titulo, descricao, categoria, data, prioridade, hora, duracao } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      if (!titulo) {
        return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
      }
      if (titulo.length < 4 || titulo.length > 48) {
        return res.status(400).json({ error: 'A tarefa deve ter entre 4 e 48 caracteres.' });
      }
      if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(titulo)) {
        return res.status(400).json({ error: 'A tarefa não pode conter caracteres especiais.' });
      }

      if (data) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data)) || isNaN(Date.parse(String(data)))) {
          return res.status(400).json({ error: 'Formato de data inválido. Use AAAA-MM-DD com uma data real.' });
        }
      }

      // Valida a hora ANTES de qualquer outra regra: nunca aceita minutos > 59 / horas > 23
      // (e rejeita tipos não-string, ex.: ["07:00"], que passariam por String()).
      if (hora !== undefined && hora !== null && hora !== '') {
        if (typeof hora !== 'string' || !HORA_REGEX.test(hora)) {
          return res.status(400).json({ error: 'Hora inválida. Use HH:MM (horas 00-23, minutos 00-59).' });
        }
      }

      const targetDate = data || new Date().toISOString().split('T')[0];

      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localNow = new Date(Date.now() - tzOffset);
      const hojeStr = localNow.toISOString().split('T')[0];
      const dayOfWeek = localNow.getDay() === 0 ? 6 : localNow.getDay() - 1;
      const maxDate = new Date(localNow);
      maxDate.setDate(localNow.getDate() - dayOfWeek + 13);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      const maxYearDate = new Date(localNow);
      maxYearDate.setFullYear(localNow.getFullYear() + 1);
      const maxYearStr = maxYearDate.toISOString().split('T')[0];

      if (targetDate < hojeStr) {
        return res.status(400).json({ error: 'Não é possível agendar para um dia no passado.' });
      } else if (categoria === 'planejamento' && targetDate > maxYearStr) {
        return res.status(400).json({ error: 'Só é possível agendar tarefas de planejamento para até 1 ano no futuro.' });
      } else if (categoria !== 'planejamento' && targetDate > maxDateStr) {
        return res.status(400).json({ error: 'Só é possível agendar tarefas normais para a semana atual e a próxima.' });
      } else if (hora) {
        if (targetDate === hojeStr) {
          const currentTotal = now.getHours() * 60 + now.getMinutes();
          const [shh, smm] = String(hora).split(':').map(Number);
          const startTotal = shh * 60 + smm;
          if (startTotal < currentTotal) {
            return res.status(400).json({ error: 'Não é possível agendar em horário que já passou hoje.' });
          }
        }
      }


      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('data', targetDate);

      const limit = targetDate > maxDateStr ? 6 : 14;

      if (count !== null && count >= limit) {
        return res.status(400).json({ error: `Limite de ${limit} tarefas por dia alcançado.` });
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          titulo,
          descricao: descricao || '',
          categoria: categoria || 'geral',
          data: targetDate,
          prioridade: prioridade || 'media',
          concluida: false,
          hora: hora || null,
          duracao: duracao || null
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({
        message: 'Tarefa criada com sucesso no Supabase!',
        task
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
      const { titulo, descricao, categoria, data, prioridade, concluida, hora, duracao } = req.body;

      const updateData: any = {};
      if (titulo !== undefined) {
        if (titulo.length < 4 || titulo.length > 48) {
          return res.status(400).json({ error: 'A tarefa deve ter entre 4 e 48 caracteres.' });
        }
        if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(titulo)) {
          return res.status(400).json({ error: 'A tarefa não pode conter caracteres especiais.' });
        }
        updateData.titulo = titulo;
      }
      if (descricao !== undefined) updateData.descricao = descricao;
      if (categoria !== undefined) updateData.categoria = categoria;
      if (data !== undefined) updateData.data = data;
      if (prioridade !== undefined) updateData.prioridade = prioridade;
      if (concluida !== undefined) updateData.concluida = !!concluida;
      if (hora !== undefined) {
        if (hora !== null && hora !== '') {
          if (typeof hora !== 'string' || !HORA_REGEX.test(hora)) {
            return res.status(400).json({ error: 'Hora inválida. Use HH:MM (horas 00-23, minutos 00-59).' });
          }
        }
        updateData.hora = hora === '' ? null : hora;
      }
      if (duracao !== undefined) updateData.duracao = duracao;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualização.' });
      }

      const { data: existingTask } = await supabase.from('tasks').select('data, categoria').eq('id', id).eq('user_id', userId).single();
      if (!existingTask) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' });
      }

      if (updateData.data !== undefined && updateData.data !== existingTask.data) {
        const { count, error: countErr } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('data', updateData.data);
        if (count && count >= 14) {
          return res.status(400).json({ error: 'Você já atingiu o limite de 14 tarefas para este dia.' });
        }
      }

      if (updateData.concluida === true) {
        const checkDate = updateData.data || existingTask.data;
        if (checkDate) {
          const now = new Date();
          const tzOffset = now.getTimezoneOffset() * 60000;
          const localNow = new Date(Date.now() - tzOffset);
          const dayOfWeek = localNow.getDay() === 0 ? 6 : localNow.getDay() - 1;
          const maxDate = new Date(localNow);
          maxDate.setDate(localNow.getDate() - dayOfWeek + 13);
          const maxDateStr = maxDate.toISOString().split('T')[0];
          if (checkDate > maxDateStr) {
            return res.status(400).json({ error: 'Tarefas de planejamento futuro não podem ser concluídas.' });
          }
        }
      }

      if (updateData.data || updateData.hora) {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localNow = new Date(Date.now() - tzOffset);
        const hojeStr = localNow.toISOString().split('T')[0];

        const dayOfWeek = localNow.getDay() === 0 ? 6 : localNow.getDay() - 1;
        const maxDate = new Date(localNow);
        maxDate.setDate(localNow.getDate() - dayOfWeek + 13);
        const maxDateStr = maxDate.toISOString().split('T')[0];

        const maxYearDate = new Date(localNow);
        maxYearDate.setFullYear(localNow.getFullYear() + 1);
        const maxYearStr = maxYearDate.toISOString().split('T')[0];

        const targetDate = updateData.data;
        if (targetDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate)) || isNaN(Date.parse(String(targetDate)))) {
            return res.status(400).json({ error: 'Formato de data inválido. Use AAAA-MM-DD com uma data real.' });
          }
          if (targetDate < hojeStr) {
            return res.status(400).json({ error: 'Não é possível agendar para um dia no passado.' });
          } else if (updateData.categoria === 'planejamento' || (existingTask && existingTask.categoria === 'planejamento')) {
            if (targetDate > maxYearStr) {
              return res.status(400).json({ error: 'Só é possível agendar tarefas de planejamento para até 1 ano no futuro.' });
            }
          } else if (targetDate > maxDateStr) {
            return res.status(400).json({ error: 'Só é possível agendar tarefas normais para a semana atual e a próxima.' });
          }
        }

        if (updateData.hora) {
          if (targetDate === hojeStr) {
            const currentTotal = now.getHours() * 60 + now.getMinutes();
            const [shh, smm] = String(updateData.hora).split(':').map(Number);
            const startTotal = shh * 60 + smm;
            if (startTotal < currentTotal) {
              return res.status(400).json({ error: 'Não é possível agendar em horário que já passou hoje.' });
            }
          }
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId) // Security: check ownership
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: `Tarefa ${id} atualizada no Supabase!`,
        task
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
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Security: check ownership

      if (error) throw error;
      res.json({ message: `Tarefa ${id} excluída do Supabase.` });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async complete(req: Request, res: Response) {
    const { id } = req.params;
    const { concluida } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { data: existingTask } = await supabase
        .from('tasks')
        .select('concluida, data')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      const wasConcluida = existingTask?.concluida || false;
      const targetConcluida = concluida ?? true;

      if (targetConcluida && existingTask?.data) {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localNow = new Date(Date.now() - tzOffset);
        const dayOfWeek = localNow.getDay() === 0 ? 6 : localNow.getDay() - 1;
        const maxDate = new Date(localNow);
        maxDate.setDate(localNow.getDate() - dayOfWeek + 13);
        const maxDateStr = maxDate.toISOString().split('T')[0];

        if (existingTask.data > maxDateStr) {
          return res.status(400).json({ error: 'Tarefas de planejamento futuro não podem ser concluídas.' });
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .update({ concluida: targetConcluida })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;



      res.json({
        message: `Tarefa ${id} marcada como ${targetConcluida ? 'concluída' : 'pendente'} no Supabase!`,
        task
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
