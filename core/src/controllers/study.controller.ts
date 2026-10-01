import { Request, Response } from 'express';
import { supabase } from '../config/supabase';


export class StudyController {
  // ── SETTINGS ──────────────────────────────────────────
  static async getSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { data, error } = await supabase
        .from('study_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Return defaults if not configured
        return res.json({
          daily_goal_min: 120,
          lifetime_stats: { totalMin: 0, totalSessions: 0, bestDayMin: 0, activeDays: [] },
          pomodoros_today: 0,
          pomodoro_date: ''
        });
      }

      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async saveSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { daily_goal_min, lifetime_stats, pomodoros_today, pomodoro_date } = req.body;

      // Validation
      if (daily_goal_min !== undefined) {
        const goal = parseInt(daily_goal_min);
        if (isNaN(goal) || goal < 0 || goal > 1080) {
          return res.status(400).json({ error: 'Meta diária deve ser entre 0 e 1080 minutos.' });
        }
      }

      if (pomodoros_today !== undefined) {
        const pToday = parseInt(pomodoros_today);
        if (isNaN(pToday) || pToday < 0) {
          return res.status(400).json({ error: 'Contador de pomodoros inválido.' });
        }
      }

      let sanitizedStats: any = undefined;
      if (lifetime_stats) {
        if (typeof lifetime_stats !== 'object') {
          return res.status(400).json({ error: 'Formato de estatísticas inválido.' });
        }
        const { totalMin, totalSessions, bestDayMin, activeDays, custom_modes, active_session } = lifetime_stats;
        if (totalMin !== undefined && totalMin < 0) return res.status(400).json({ error: 'Valores das estatísticas não podem ser negativos.' });
        
        sanitizedStats = {
          totalMin: typeof totalMin === 'number' ? totalMin : 0,
          totalSessions: typeof totalSessions === 'number' ? totalSessions : 0,
          bestDayMin: typeof bestDayMin === 'number' ? bestDayMin : 0,
          activeDays: Array.isArray(activeDays) ? activeDays.slice(0, 365) : []
        };

        if (Array.isArray(custom_modes)) {
          sanitizedStats.custom_modes = custom_modes.slice(0, 10).map((m: any) => ({
            focusMin: typeof m.focusMin === 'number' ? m.focusMin : 50,
            restMin: typeof m.restMin === 'number' ? m.restMin : 10,
            name: typeof m.name === 'string' ? m.name.substring(0, 50) : ''
          }));
        }

        if (active_session && typeof active_session === 'object') {
          sanitizedStats.active_session = {
            subject: typeof active_session.subject === 'string' ? active_session.subject.substring(0, 50) : '',
            mode: typeof active_session.mode === 'string' ? active_session.mode.substring(0, 20) : 'focus',
            phase: typeof active_session.phase === 'string' ? active_session.phase.substring(0, 10) : 'focus',
            cycleNum: typeof active_session.cycleNum === 'number' ? active_session.cycleNum : 1,
            totalFocusSec: typeof active_session.totalFocusSec === 'number' ? active_session.totalFocusSec : 0,
            studyTimerSeconds: typeof active_session.studyTimerSeconds === 'number' ? active_session.studyTimerSeconds : 0,
            studyTimerTotal: typeof active_session.studyTimerTotal === 'number' ? active_session.studyTimerTotal : 1500,
            isRunning: Boolean(active_session.isRunning),
            timestamp: typeof active_session.timestamp === 'number' ? active_session.timestamp : Date.now()
          };
        }
      }

      const { data, error } = await supabase
        .from('study_settings')
        .upsert({
          user_id: userId,
          daily_goal_min: daily_goal_min !== undefined ? parseInt(daily_goal_min) : undefined,
          lifetime_stats: sanitizedStats || undefined,
          pomodoros_today: pomodoros_today !== undefined ? parseInt(pomodoros_today) : undefined,
          pomodoro_date: pomodoro_date !== undefined ? String(pomodoro_date) : undefined
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ message: 'Configurações de estudos salvas com sucesso!', settings: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ── TRACKS (MATÉRIAS) ──────────────────────────────────
  static async getTracks(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { data, error } = await supabase
        .from('study_tracks')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: true });

      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async saveTrack(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { track_id, name, icon, description } = req.body;

      if (!track_id) {
        return res.status(400).json({ error: 'ID da matéria (track_id) é obrigatório.' });
      }
      if (!name) {
        return res.status(400).json({ error: 'Nome da matéria é obrigatório.' });
      }
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 38) {
        return res.status(400).json({ error: 'Nome da matéria deve ter entre 2 e 38 caracteres.' });
      }
      if (!/^[a-zA-Z0-9À-ÿ\s\-_]+$/.test(trimmedName)) {
        return res.status(400).json({ error: 'Nome da matéria não pode conter caracteres especiais.' });
      }
      if (description && description.length > 25) {
        return res.status(400).json({ error: 'Descrição da matéria deve ter no máximo 25 caracteres.' });
      }

      if (icon) {
        if (!icon.startsWith('data:image/png;base64,') && !icon.startsWith('data:image/jpeg;base64,') && !icon.startsWith('data:image/webp;base64,')) {
          return res.status(400).json({ error: 'A imagem deve ser no formato PNG, JPG/JPEG ou WEBP.' });
        }
        // 2MB de arquivo original convertido para base64 resulta em ~2.800.000 caracteres
        if (icon.length > 2800000) {
          return res.status(400).json({ error: 'A imagem excede o tamanho máximo de 2MB.' });
        }
      }

      // Check limits (max 16 tracks per user)
      const { data: existingTrack } = await supabase
        .from('study_tracks')
        .select('id, name')
        .eq('user_id', userId)
        .eq('track_id', track_id)
        .maybeSingle();

      if (!existingTrack) {
        // Verificar se nome já existe para outra matéria
        const escapedName = trimmedName.replace(/([%_\\])/g, '\\$1');
        const { data: duplicateName } = await supabase
          .from('study_tracks')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', escapedName)
          .maybeSingle();
        
        if (duplicateName) {
          return res.status(400).json({ error: 'Você já possui uma matéria com este nome.' });
        }

        const { count, error: countErr } = await supabase
          .from('study_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countErr) throw countErr;
        if (count && count >= 16) {
          return res.status(400).json({ error: 'Limite máximo de 16 matérias atingido.' });
        }
      } else {
        // Edit mode: still need to check duplicate name
        const escapedName = trimmedName.replace(/([%_\\])/g, '\\$1');
        const { data: duplicateName } = await supabase
          .from('study_tracks')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', escapedName)
          .neq('track_id', track_id)
          .maybeSingle();
        
        if (duplicateName) {
          return res.status(400).json({ error: 'Você já possui uma matéria com este nome.' });
        }
      }

      const { data, error } = await supabase
        .from('study_tracks')
        .upsert({
          user_id: userId,
          track_id,
          name: trimmedName,
          icon: icon || null,
          description: description ? description.trim() : null
        }, { onConflict: 'user_id,track_id' })
        .select()
        .single();

      if (error) throw error;
      res.json({ message: 'Matéria salva com sucesso!', track: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteTrack(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { track_id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      // Delete track
      const { error: trackErr } = await supabase
        .from('study_tracks')
        .delete()
        .eq('user_id', userId)
        .eq('track_id', track_id);

      if (trackErr) throw trackErr;

      // Delete associated study plan
      await supabase
        .from('study_plans')
        .delete()
        .eq('user_id', userId)
        .eq('track_id', track_id);

      res.json({ message: 'Matéria excluída com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ── NOTES (ANOTAÇÕES) ──────────────────────────────────
  static async getNotes(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { data, error } = await supabase
        .from('study_notes')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async saveNote(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { note_id, subject, content, criado_em, editado_em } = req.body;

      if (!note_id) {
        return res.status(400).json({ error: 'ID da anotação (note_id) é obrigatório.' });
      }
      if (!content || content.trim().length < 4 || content.length > 500) {
        return res.status(400).json({ error: 'Anotação deve ter entre 4 e 500 caracteres.' });
      }
      if (subject) {
        const s = subject.trim();
        if (s.length < 3 || s.length > 25) {
          return res.status(400).json({ error: 'Título deve ter entre 3 e 25 caracteres.' });
        }
        if (/[\r\n]/.test(s) || /[^a-zA-Z0-9À-ÿ ]/.test(s)) {
          return res.status(400).json({ error: 'Título não pode conter caracteres especiais ou quebras de linha.' });
        }
      }

      // Check limits (max 50 notes per user)
      const { data: existingNote } = await supabase
        .from('study_notes')
        .select('id')
        .eq('user_id', userId)
        .eq('note_id', note_id)
        .maybeSingle();

      if (!existingNote) {
        const { count, error: countErr } = await supabase
          .from('study_notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countErr) throw countErr;
        if (count && count >= 15) {
          return res.status(400).json({ error: 'Limite máximo de 15 anotações atingido.' });
        }
      }

      const { data, error } = await supabase
        .from('study_notes')
        .upsert({
          user_id: userId,
          note_id,
          subject: subject ? subject.trim() : null,
          content: content.trim(),
          criado_em: criado_em || undefined,
          editado_em: editado_em || undefined
        }, { onConflict: 'user_id,note_id' })
        .select()
        .single();

      if (error) throw error;
      res.json({ message: 'Anotação salva com sucesso!', note: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteNote(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { note_id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { error } = await supabase
        .from('study_notes')
        .delete()
        .eq('user_id', userId)
        .eq('note_id', note_id);

      if (error) throw error;
      res.json({ message: 'Anotação excluída com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ── PLANS (MÓDULOS & TÓPICOS) ──────────────────────────
  static async getPlan(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { track_id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { data, error } = await supabase
        .from('study_plans')
        .select('modules')
        .eq('user_id', userId)
        .eq('track_id', track_id)
        .maybeSingle();

      if (error) throw error;
      res.json(data ? data.modules : []);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async savePlan(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { track_id, modules } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }
      if (!track_id) {
        return res.status(400).json({ error: 'ID da matéria (track_id) é obrigatório.' });
      }
      if (!Array.isArray(modules)) {
        return res.status(400).json({ error: 'Módulos deve ser um array.' });
      }

      // Validations: Max 30 modules
      if (modules.length > 30) {
        return res.status(400).json({ error: 'Máximo de 30 módulos por matéria.' });
      }

      for (const mod of modules) {
        if (!mod.id) {
          return res.status(400).json({ error: 'Todos os módulos devem ter ID.' });
        }
        if (mod.name) {
          const modName = mod.name.trim();
          if (modName.length < 3 || modName.length > 58) {
            return res.status(400).json({ error: 'Nome do módulo deve ter entre 3 e 58 caracteres.' });
          }
          if (!/^[a-zA-Z0-9À-ÿ\s\-_.,:;!?ºª°()\/]+$/.test(modName)) {
            return res.status(400).json({ error: 'Nome do módulo contém caracteres especiais não permitidos.' });
          }
        }
        if (mod.tasks) {
          if (!Array.isArray(mod.tasks)) {
            return res.status(400).json({ error: 'Módulo tasks deve ser um array.' });
          }
          if (mod.tasks.length > 20) {
            return res.status(400).json({ error: 'Máximo de 20 tópicos por módulo.' });
          }
          for (const task of mod.tasks) {
            if (task.text) {
              const taskText = task.text.trim();
              if (taskText.length < 3 || taskText.length > 58) {
                return res.status(400).json({ error: 'Título do tópico deve ter entre 3 e 58 caracteres.' });
              }
              if (!/^[a-zA-Z0-9À-ÿ\s\-_.,:;!?ºª°()\/\[\]{}<>^~]+$/.test(taskText)) {
                return res.status(400).json({ error: 'Título do tópico contém caracteres especiais não permitidos.' });
              }
            }
          }
        }
      }

      const { data, error } = await supabase
        .from('study_plans')
        .upsert({
          user_id: userId,
          track_id,
          modules
        }, { onConflict: 'user_id,track_id' })
        .select()
        .single();

      if (error) throw error;
      res.json({ message: 'Plano de estudos salvo com sucesso!', plan: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ── SESSIONS (HISTÓRICO) ──────────────────────────────
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { startDate } = req.query;
      let query = supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false });

      if (startDate) {
        query = query.gte('data', startDate as string);
      }
      query = query.limit(2000);
      const { data, error } = await query;

      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const { trilha, descricao, duracao_min, data: dataStr } = req.body;

      const category = trilha || req.body.categoria || 'Geral';
      const title = descricao || req.body.titulo || 'Foco';
      const duration = parseInt(duracao_min);
      const targetDate = dataStr || new Date().toISOString().split('T')[0];

      // Validation
      if (isNaN(duration) || duration < 20 || duration > 1080) {
        return res.status(400).json({ error: 'Duração da sessão deve ser entre 20 e 1080 minutos.' });
      }
      if (!category || category.trim().length === 0) {
        return res.status(400).json({ error: 'Matéria é obrigatória.' });
      }

      // Check daily sessions limit (max 3 per day)
      const { count, error: countErr } = await supabase
        .from('study_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('data', targetDate);

      if (countErr) throw countErr;
      if (count && count >= 3) {
        return res.status(400).json({ error: 'Limite diário de 3 sessões atingido.' });
      }

      const { data: session, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          titulo: title.trim(),
          duracao_min: duration,
          categoria: category.trim(),
          data: targetDate
        })
        .select()
        .single();

      if (error) throw error;


      res.status(201).json({
        message: 'Sessão de estudos registrada com sucesso!',
        session
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
