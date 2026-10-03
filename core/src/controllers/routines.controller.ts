import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Hora HH:MM válida (00:00–23:59): minutos só de 00 a 59.
const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class RoutinesController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      let preset = parseInt(req.query.preset as string);
      if (!preset) {
        const { data: user } = await supabase.from('users').select('rotina_preset').eq('id', userId).single();
        preset = user?.rotina_preset || 1;
      }

      const { data: routines, error } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', userId)
        .eq('preset', preset)
        .order('hora', { ascending: true });

      if (error) throw error;
      res.json(routines);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async create(req: Request, res: Response) {
    const { hora, titulo, dias_semana } = req.body;
    let { preset } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      if (!hora || !titulo || !Array.isArray(dias_semana) || dias_semana.length === 0) {
        return res.status(400).json({ error: 'Hora, título e pelo menos um dia da semana são obrigatórios' });
      }

      if (typeof titulo !== 'string' || titulo.length < 3 || titulo.length > 40) {
        return res.status(400).json({ error: 'O título deve ter entre 3 e 40 caracteres.' });
      }

      if (!/^[a-zA-Z0-9\sÀ-ÿ+()\-]+$/.test(titulo)) {
        return res.status(400).json({ error: 'A rotina não pode conter caracteres especiais.' });
      }

      if (typeof hora !== 'string' || !HORA_REGEX.test(hora)) {
        return res.status(400).json({ error: 'Hora inválida. Use HH:MM (horas 00-23, minutos 00-59).' });
      }

      if (dias_semana.length < 1 || dias_semana.length > 7 || dias_semana.some((d: any) => typeof d !== 'number' || d < 1 || d > 7)) {
        return res.status(400).json({ error: 'Seleção de dias da semana inválida.' });
      }

      if (!preset) {
        const { data: user } = await supabase.from('users').select('rotina_preset').eq('id', userId).single();
        preset = user?.rotina_preset || 1;
      }

      const { data: existingRoutines, error: routinesError } = await supabase
        .from('routines')
        .select('dia_semana')
        .eq('user_id', userId)
        .eq('preset', preset);

      if (routinesError) throw routinesError;

      const countByDay = Array(8).fill(0);
      (existingRoutines || []).forEach(r => {
        if (r.dia_semana >= 1 && r.dia_semana <= 7) {
          countByDay[r.dia_semana]++;
        }
      });

      for (const dia of dias_semana) {
        if (countByDay[dia] >= 24) {
          return res.status(400).json({ error: `Limite de 24 rotinas alcançado no dia selecionado.` });
        }
      }

      const inserts = dias_semana.map((dia: number) => ({
        user_id: userId,
        hora,
        titulo,
        dia_semana: dia,
        preset
      }));

      const { data: routines, error } = await supabase
        .from('routines')
        .insert(inserts)
        .select();

      if (error) throw error;
      res.status(201).json({
        message: 'Item(ns) de rotina criado(s) com sucesso!',
        routines
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
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { error } = await supabase
        .from('routines')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      res.json({ message: 'Item de rotina excluído com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteMultiple(req: Request, res: Response) {
    const { ids } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'IDs de rotina não informados' });
      }

      const { error } = await supabase
        .from('routines')
        .delete()
        .in('id', ids)
        .eq('user_id', userId);

      if (error) throw error;
      res.json({ message: 'Itens de rotina excluídos com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async setPreset(req: Request, res: Response) {
    const { preset } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { error } = await supabase
        .from('users')
        .update({ rotina_preset: preset })
        .eq('id', userId);

      if (error) throw error;
      res.json({ message: 'Preset atualizado com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
