import { Request, Response } from 'express';
import { supabase, formatUser } from '../config/supabase';

export class DashboardController {
  static async summary(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      // Query database tables in parallel for maximum speed
      const [
        userRes,
        tasksRes,
        financesRes,
        focusRes,
        studyRes,
        healthRes
      ] = await Promise.all([
        supabase.from('users').select('id, email, nome, role, streak, avatar_url, bio, tema, criado_em, ativo, nascimento, handle, social1, social2, profile_page_bg, profile_page_bg_img, profile_kout, profile_font, profile_bg, profile_bg_opacity, profile_page_bg_opacity, avatar_border, profile_theme, avatar_type, avatar, account_number, customization_json, rotina_preset').eq('id', userId).single(),
        supabase.from('tasks').select('*').eq('user_id', userId).order('criado_em', { ascending: false }).limit(2000),
        supabase.from('finances').select('*').eq('user_id', userId).order('data', { ascending: false }).limit(2000),
        supabase.from('focus_sessions').select('*').eq('user_id', userId).order('criado_em', { ascending: false }).limit(2000),
        supabase.from('study_sessions').select('*').eq('user_id', userId).order('data', { ascending: false }).limit(2000),
        supabase.from('health_logs').select('*').eq('user_id', userId).order('data', { ascending: false }).limit(2000)
      ]);

      if (userRes.error) throw userRes.error;

      // Process finance totals
      let totalIncome = 0;
      let totalExpense = 0;
      financesRes.data?.forEach((t: any) => {
        const val = parseFloat(t.valor) || 0;
        if (t.tipo === 'receita') {
          totalIncome += val;
        } else {
          totalExpense += val;
        }
      });

      // Process focus minutes
      let totalFocusMinutes = 0;
      focusRes.data?.forEach((s: any) => {
        totalFocusMinutes += parseInt(s.duracao_min) || 0;
      });

      res.json({
        user: formatUser(userRes.data),
        tasks: tasksRes.data || [],
        goals: [],
        finances: {
          income: totalIncome,
          expense: totalExpense,
          balance: totalIncome - totalExpense,
          transactions: financesRes.data || []
        },
        focus: {
          totalMinutes: totalFocusMinutes,
          sessionsCount: focusRes.data?.length || 0
        },
        studySessions: studyRes.data || [],
        healthLogs: healthRes.data || []
      });
    } catch (err: any) {
      console.error('[DashboardController] Error fetching summary:', err.message);
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
