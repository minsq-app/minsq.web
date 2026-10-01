import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class DmController {
  static async createDM(req: AuthenticatedRequest, res: Response) {
    try {
      const { message, email } = req.body;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }

      // Calcula o limite de 4 mensagens nos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count, error: countError } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (countError) {
        console.error('[DM] Count Error:', countError.message);
        return res.status(500).json({ error: 'Erro ao validar limite de mensagens.' });
      }

      if (count !== null && count >= 4) {
        return res.status(429).json({ error: 'Você atingiu o limite de 4 mensagens diretas por semana.' });
      }

      // Higienização severa contra injeção de HTML/Scripts (XSS)
      const cleanMessage = typeof message === 'string' 
        ? message.replace(/[<>]/g, '').trim() 
        : '';

      const { error } = await supabase
        .from('direct_messages')
        .insert([{
          user_id: userId,
          mensagem: cleanMessage,
          email: email || null
        }]);

      if (error) {
        console.error('[DM] Supabase Insert Error:', error.message);
        return res.status(500).json({ error: 'Erro ao salvar a mensagem direta.' });
      }

      return res.status(201).json({ message: 'Mensagem enviada com sucesso!' });
    } catch (err: any) {
      console.error('[DM] Internal Error:', err.message);
      return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
