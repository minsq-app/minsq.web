import { Request, Response } from 'express';
import { supabase } from '../config/supabase';


export class PlansActionController {
  // GET /api/plans_action — lista todos os Planos de Ação do usuário
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { data, error } = await supabase
        .from('plans_action')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: true });

      if (error) throw error;

      // Mapeia plan_id → cat_id para compatibilidade com o frontend
      const mapped = (data || []).map((r: any) => ({
        ...r,
        cat_id: r.plan_id,
      }));

      res.json(mapped);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // POST /api/plans_action — cria ou atualiza um Plano de Ação (upsert por plan_id)
  static async upsert(req: Request, res: Response) {
    const { cat_id, name, photo_url, desc, desc_align } = req.body;

    if (!cat_id || !name) {
      res.status(400).json({ error: 'cat_id e name são obrigatórios.' });
      return;
    }

    if (name.length > 60) {
      res.status(400).json({ error: 'O título da meta pode ter no máximo 60 caracteres.' });
      return;
    }

    if (desc && desc.length > 0 && desc.length < 8) {
      res.status(400).json({ error: 'A descrição da meta deve ter no mínimo 8 caracteres.' });
      return;
    }

    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // Verifica limite de metas (Max 7)
      const { data: existingMetas, error: countError } = await supabase
        .from('plans_action')
        .select('plan_id')
        .eq('user_id', userId);

      if (countError) throw countError;

      const userMetas = existingMetas || [];
      const isNew = !userMetas.some(m => m.plan_id === cat_id);

      if (isNew && userMetas.length >= 7) {
        res.status(400).json({ error: 'Você atingiu o limite máximo de 7 metas.' });
        return;
      }

      const { data, error } = await supabase
        .from('plans_action')
        .upsert(
          { user_id: userId, plan_id: cat_id, name, desc, desc_align: desc_align || 'center', photo_url: photo_url || null },
          { onConflict: 'user_id,plan_id' }
        )
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: 'Plano de Ação salvo!', category: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // DELETE /api/plans_action/:cat_id — remove um Plano de Ação
  static async delete(req: Request, res: Response) {
    const { cat_id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { error } = await supabase
        .from('plans_action')
        .delete()
        .eq('user_id', userId)
        .eq('plan_id', cat_id);

      if (error) throw error;
      res.json({ message: `Plano de Ação ${cat_id} removido.` });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
