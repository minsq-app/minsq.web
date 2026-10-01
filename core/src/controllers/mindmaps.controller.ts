import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to get or create a mock user

export class MindmapsController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { data, error } = await supabase
        .from('mindmaps')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async create(req: Request, res: Response) {
    const { map_id, title, layout, pan, scale, nodes, photo } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // Verifica limite de mapas mentais (Max 6)
      const { data: existingMaps, error: countError } = await supabase
        .from('mindmaps')
        .select('map_id')
        .eq('user_id', userId);

      if (countError) throw countError;

      const userMaps = existingMaps || [];
      const isNew = !userMaps.some(m => m.map_id === map_id);

      if (isNew && userMaps.length >= 6) {
        res.status(400).json({ error: 'Você atingiu o limite máximo de 6 planos de ação.' });
        return;
      }

      const { data, error } = await supabase
        .from('mindmaps')
        .insert({
          user_id: userId,
          map_id,
          title,
          layout: layout || 'horizontal',
          pan: pan || { x: 0, y: 0 },
          scale: scale || 1.0,
          nodes: nodes || [],
          photo
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({
        message: 'Mapa mental criado com sucesso no Supabase!',
        mindmap: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async update(req: Request, res: Response) {
    const { map_id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // Whitelist + normalize camelCase → snake_case
      const allowed: Record<string, any> = {};
      const fieldMap: Record<string, string> = {
        title: 'title',
        layout: 'layout',
        pan: 'pan',
        scale: 'scale',
        nodes: 'nodes',
        photo: 'photo',
      };
      for (const [k, v] of Object.entries(req.body)) {
        if (fieldMap[k]) allowed[fieldMap[k]] = v;
      }

      const { data, error } = await supabase
        .from('mindmaps')
        .update(allowed)
        .eq('user_id', userId)
        .eq('map_id', map_id)
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: `Mapa mental ${map_id} atualizado no Supabase!`,
        mindmap: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async delete(req: Request, res: Response) {
    const { map_id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { error } = await supabase
        .from('mindmaps')
        .delete()
        .eq('user_id', userId)
        .eq('map_id', map_id);

      if (error) throw error;
      res.json({ message: `Mapa mental ${map_id} excluído com sucesso.` });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
