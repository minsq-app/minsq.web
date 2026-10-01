import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to get or create a mock user

export class FocusController {
  static async stats(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('duracao_min, tipo')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false })
        .limit(2000);

      if (error) throw error;

      let totalMinutes = 0;
      let sessionsCount = data?.length || 0;
      let pomodorosCompleted = 0;

      data?.forEach((session: any) => {
        totalMinutes += parseInt(session.duracao_min) || 0;
        if (session.tipo === 'pomodoro') {
          pomodorosCompleted += 1;
        }
      });

      res.json({
        totalMinutes,
        sessionsCount,
        pomodorosCompleted,
        dailyAverageMinutes: sessionsCount > 0 ? Math.round(totalMinutes / 7) : 0 // dummy weekly average
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async log(req: Request, res: Response) {
    const { duracao_min, tipo, data } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { data: focusSession, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: userId,
          duracao_min: parseInt(duracao_min),
          tipo: tipo || 'pomodoro',
          data: data || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({
        message: 'Sessão de foco registrada com sucesso!',
        session: focusSession
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ── FOLDERS (PASTAS) ──────────────────────────────────
  static async getFolders(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado' });

      const { data, error } = await supabase
        .from('foco_folders')
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

  static async createFolder(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado' });

      const { name } = req.body;
      if (!name || name.trim().length < 3 || name.trim().length > 48) {
        return res.status(400).json({ error: 'Nome inválido. Mínimo 3 e máximo 48 caracteres.' });
      }

      // Check folder limits (max 6 folders per user)
      const { count, error: countErr } = await supabase
        .from('foco_folders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countErr) throw countErr;
      if (count && count >= 6) {
        return res.status(400).json({ error: 'Limite de 6 pastas atingido.' });
      }

      // Check for duplicate name
      const escapedName = name.trim().replace(/([%_\\])/g, '\\$1');
      const { data: duplicate } = await supabase
        .from('foco_folders')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', escapedName)
        .maybeSingle();

      if (duplicate) {
        return res.status(400).json({ error: 'Já existe uma pasta com esse nome.' });
      }

      const { data, error } = await supabase
        .from('foco_folders')
        .insert({
          user_id: userId,
          name: name.trim()
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: 'Pasta criada com sucesso!', folder: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteFolder(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado' });

      const { id } = req.params;

      const { error } = await supabase
        .from('foco_folders')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);

      if (error) throw error;
      res.json({ message: 'Pasta apagada com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ── ROUTINES (ROTINAS) ────────────────────────────────
  static async getRoutines(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado' });

      const { data, error } = await supabase
        .from('foco_routines')
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

  static async createRoutine(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado' });

      const { name, durationMin, folderId, exercises } = req.body;
      if (!name || name.trim().length < 3 || name.trim().length > 46) {
        return res.status(400).json({ error: 'Nome da rotina deve ter entre 3 e 46 caracteres.' });
      }
      if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
        return res.status(400).json({ error: 'Adicione pelo menos um exercício.' });
      }
      if (exercises.length > 12) {
        return res.status(400).json({ error: 'O limite é de 12 exercícios por rotina.' });
      }

      // Check duplicates
      const exerciseNames = exercises.map(e => e.name);
      if (new Set(exerciseNames).size !== exerciseNames.length) {
        return res.status(400).json({ error: 'Não é permitido adicionar o mesmo exercício duas vezes.' });
      }

      // Build valid rest options for validation
      const validRestTimes = ['Desligado'];
      for (let s = 5; s <= 180; s += 5) {
        const m = Math.floor(s / 60);
        const remS = s % 60;
        validRestTimes.push(`${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`);
      }
      for (let s = 210; s <= 420; s += 30) {
        const m = Math.floor(s / 60);
        const remS = s % 60;
        validRestTimes.push(`${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`);
      }
      const validTypes = ['warmup', 'normal', 'failure'];

      // Validate each exercise and its sets
      for (const ex of exercises) {
        if (ex.note && ex.note.length > 90) {
          return res.status(400).json({ error: 'A nota do exercício não pode passar de 90 caracteres.' });
        }
        if (ex.restTime && !validRestTimes.includes(ex.restTime)) {
          return res.status(400).json({ error: 'Temporizador de descanso inválido.' });
        }
        if (ex.sets) {
          if (ex.sets.length > 10) {
            return res.status(400).json({ error: 'Máximo de 10 séries por exercício excedido.' });
          }
          for (const set of ex.sets) {
            if (set.type && !validTypes.includes(set.type)) {
              return res.status(400).json({ error: 'Tipo de série inválido. Aceitos: warmup, normal, failure.' });
            }
            if (set.kg !== undefined && set.kg !== '' && Number(set.kg) > 600) {
              return res.status(400).json({ error: 'Peso (KG) excede o limite de 600kg.' });
            }
            if (set.reps !== undefined && set.reps !== '' && Number(set.reps) > 200) {
              return res.status(400).json({ error: 'Repetições (REPS) excedem o limite de 200.' });
            }
            if (set.speed !== undefined && set.speed !== '' && Number(set.speed) > 30) {
              return res.status(400).json({ error: 'A velocidade não pode exceder 30.' });
            }
            if (set.rpm !== undefined && set.rpm !== '' && Number(set.rpm) > 40) {
              return res.status(400).json({ error: 'O RPM médio não pode exceder 40.' });
            }
            if (set.duration && typeof set.duration === 'string' && set.duration.includes(':')) {
              const [m, s] = set.duration.split(':').map(Number);
              if (!isNaN(m) && !isNaN(s) && (m > 1080 || (m === 1080 && s > 0))) {
                return res.status(400).json({ error: 'A duração não pode exceder 18 horas (1080 minutos).' });
              }
            }
          }
        }
      }

      // Check routines limits (max 24 routines per user)
      const { count, error: countErr } = await supabase
        .from('foco_routines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countErr) throw countErr;
      if (count && count >= 24) {
        return res.status(400).json({ error: 'Limite de 24 rotinas atingido.' });
      }

      if (folderId) {
        const { data: f } = await supabase.from('foco_folders')
          .select('id').eq('id', folderId).eq('user_id', userId).maybeSingle();
        if (!f) return res.status(400).json({ error: 'Pasta inválida.' });
      }

      const { data, error } = await supabase
        .from('foco_routines')
        .insert({
          user_id: userId,
          name: name.trim(),
          duration_min: Math.round(durationMin || 0),
          folder_id: folderId || null,
          exercises: exercises
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: 'Rotina criada com sucesso!', routine: data });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteRoutine(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado' });

      const { id } = req.params;

      const { error } = await supabase
        .from('foco_routines')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);

      if (error) throw error;
      res.json({ message: 'Rotina removida com sucesso!' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }


}

