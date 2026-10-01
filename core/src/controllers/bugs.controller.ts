import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class BugsController {
  static async create(req: Request, res: Response) {
    const { titulo, descricao, gravidade, device_info, logs } = req.body;
    try {
      const userId = (req as any).userId;

      if (!titulo || !descricao) {
        return res.status(400).json({ error: 'Título e descrição do bug são obrigatórios.' });
      }

      const { data: bug, error } = await supabase
        .from('bug_reports')
        .insert({
          user_id: userId || null, // Can be anonymous if auth failed, but usually auth is required
          titulo,
          descricao,
          gravidade: gravidade || 'medio',
          device_info: device_info || {},
          logs: logs || '',
          status: 'aberto'
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: 'Relatório de bug registrado com sucesso. Obrigado!',
        bug
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
