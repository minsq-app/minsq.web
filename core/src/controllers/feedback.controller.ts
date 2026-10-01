import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class FeedbackController {
  static async createFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, message, rating, email } = req.body;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      // Verifica o limite de 4 feedbacks por semana
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count, error: countError } = await supabase
        .from('feedbacks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneWeekAgo.toISOString());

      if (countError) {
        console.error('[Feedback] Limit Check Error:', countError.message);
        return res.status(500).json({ error: 'Erro ao verificar limites de envio.' });
      }

      if (count !== null && count >= 4) {
        return res.status(429).json({ error: 'Você atingiu o limite máximo de 4 feedbacks por semana.' });
      }

      const { error } = await supabase
        .from('feedbacks')
        .insert([{
          user_id: userId,
          tipo: type,
          mensagem: message,
          estrelas: rating || null,
          email: email || null
        }]);

      if (error) {
        // Safe to log server-side for backend debugging, but won't show in the frontend console as per user request
        console.error('[Feedback] Supabase Insert Error:', error.message);
        return res.status(500).json({ error: 'Erro ao salvar o feedback no banco de dados.' });
      }

      return res.status(201).json({ message: 'Feedback enviado com sucesso!' });
    } catch (err: any) {
      console.error('[Feedback] Internal Error:', err.message);
      return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
