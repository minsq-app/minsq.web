import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to get or create a mock user

export class AddictionsController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { data, error } = await supabase
        .from('addictions')
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
    const { addiction_id, nome, desc_text, started_at } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      if (!nome) return res.status(400).json({ error: 'Nome do vício é obrigatório.' });
      if (nome.length < 4 || nome.length > 38) return res.status(400).json({ error: 'O nome do vício deve ter entre 4 e 38 caracteres.' });
      if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(nome)) return res.status(400).json({ error: 'O nome do vício não pode conter caracteres especiais.' });

      const { data: existing, error: countErr } = await supabase
        .from('addictions')
        .select('id')
        .eq('user_id', userId);

      if (countErr) throw countErr;
      if (existing && existing.length >= 10) {
        return res.status(400).json({ error: 'Você atingiu o limite máximo de 10 vícios monitorados.' });
      }

      const { data, error } = await supabase
        .from('addictions')
        .insert({
          user_id: userId,
          addiction_id,
          nome,
          desc_text: desc_text || '',
          started_at: started_at || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({
        message: 'Rastreamento de vício criado com sucesso!',
        addiction: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async update(req: Request, res: Response) {
    const { addiction_id } = req.params;
    const { nome, desc_text, started_at } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      if (nome) {
        if (nome.length < 4 || nome.length > 38) return res.status(400).json({ error: 'O nome do vício deve ter entre 4 e 38 caracteres.' });
        if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(nome)) return res.status(400).json({ error: 'O nome do vício não pode conter caracteres especiais.' });
      }

      const { data, error } = await supabase
        .from('addictions')
        .update({
          nome,
          desc_text,
          started_at
        })
        .eq('user_id', userId)
        .eq('addiction_id', addiction_id)
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: `Rastreamento ${addiction_id} atualizado!`,
        addiction: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async delete(req: Request, res: Response) {
    const { addiction_id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { error } = await supabase
        .from('addictions')
        .delete()
        .eq('user_id', userId)
        .eq('addiction_id', addiction_id);

      if (error) throw error;
      res.json({ message: `Vício ${addiction_id} excluído com sucesso.` });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
