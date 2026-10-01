import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to get or create a mock user

export class HealthController {
  // Settings Endpoints
  static async getSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      let { data, error } = await supabase
        .from('health_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create default settings row
        const { data: newData, error: insertError } = await supabase
          .from('health_settings')
          .insert({
            user_id: userId,
            workout_weeks: [{ title: 'Treino I', days: [], ficha: {} }],
            diet_config: { days: [], refeicoesPorDia: 3 },
            water_goal: 2.0,
            weight_goal: null
          })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newData;
      }

      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async saveSettings(req: Request, res: Response) {
    const { workout_weeks, diet_config, water_goal, weight_goal } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // 1. Validate workout_weeks
      if (workout_weeks !== undefined) {
        if (!Array.isArray(workout_weeks)) {
          return res.status(400).json({ error: 'workout_weeks deve ser um array.' });
        }
        if (workout_weeks.length > 6) {
          return res.status(400).json({ error: 'Limite excedido: máximo de 6 semanas de treinos.' });
        }
        // Basic check inside weeks
        for (const week of workout_weeks) {
          if (week.ficha) {
            const daysCount = Object.keys(week.ficha).length;
            if (daysCount > 7) {
              return res.status(400).json({ error: 'Uma ficha de treino não pode conter mais que 7 dias.' });
            }
            for (const dayKey of Object.keys(week.ficha)) {
              const dayData = week.ficha[dayKey];
              if (dayData && Array.isArray(dayData.exercicios)) {
                if (dayData.exercicios.length > 15) {
                  return res.status(400).json({ error: 'Limite excedido: máximo de 15 exercícios por dia.' });
                }
              }
            }
          }
        }
      }

      // 2. Validate diet_config
      if (diet_config !== undefined) {
        if (typeof diet_config !== 'object' || diet_config === null) {
          return res.status(400).json({ error: 'diet_config deve ser um objeto válido.' });
        }
        const days = diet_config.days;
        if (days !== undefined) {
          if (!Array.isArray(days)) {
            return res.status(400).json({ error: 'diet_config.days deve ser um array.' });
          }
          if (days.length > 7) {
            return res.status(400).json({ error: 'Limite excedido: máximo de 7 dietas.' });
          }
          
          const dietNames = new Set<string>();
          const nameRegex = /^[A-Za-zÀ-ÿ0-9\s]+$/;

          for (const day of days) {
            const dietName = day.nome?.trim();
            if (!dietName || dietName.length < 3 || dietName.length > 30) {
              return res.status(400).json({ error: 'O nome da dieta deve ter entre 3 e 30 caracteres.' });
            }
            if (!nameRegex.test(dietName)) {
              return res.status(400).json({ error: `O nome da dieta "${dietName}" não pode conter caracteres especiais.` });
            }
            const dietNameLower = dietName.toLowerCase();
            if (dietNames.has(dietNameLower)) {
              return res.status(400).json({ error: `O nome da dieta "${dietName}" já existe.` });
            }
            dietNames.add(dietNameLower);

            const meals = day.refeicoes;
            if (meals !== undefined) {
              if (!Array.isArray(meals)) {
                return res.status(400).json({ error: 'refeicoes deve ser um array.' });
              }
              if (meals.length > 8) {
                return res.status(400).json({ error: `A dieta "${dietName}" não pode ter mais de 8 refeições.` });
              }
              
              const mealNames = new Set<string>();

              for (const meal of meals) {
                const mealName = meal.nome?.trim();
                if (!mealName || mealName.length < 3 || mealName.length > 30) {
                  return res.status(400).json({ error: 'O nome da refeição deve ter entre 3 e 30 caracteres.' });
                }
                if (!nameRegex.test(mealName)) {
                  return res.status(400).json({ error: `O nome da refeição "${mealName}" não pode conter caracteres especiais.` });
                }
                const mealNameLower = mealName.toLowerCase();
                if (mealNames.has(mealNameLower)) {
                  return res.status(400).json({ error: `O nome da refeição "${mealName}" já existe nesta dieta.` });
                }
                mealNames.add(mealNameLower);

                const mKcal = Number(meal.kcal || 0);
                const mProt = Number(meal.prot || 0);
                const mCarb = Number(meal.carb || 0);
                const mGord = Number(meal.gord || 0);

                if (isNaN(mKcal) || mKcal < 0 || mKcal > 9000) {
                  return res.status(400).json({ error: 'Calorias da refeição inválidas.' });
                }
                if (isNaN(mProt) || mProt < 0 || mProt > 600) {
                  return res.status(400).json({ error: 'Proteínas da refeição inválidas.' });
                }
                if (isNaN(mCarb) || mCarb < 0 || mCarb > 1000) {
                  return res.status(400).json({ error: 'Carboidratos da refeição inválidos.' });
                }
                if (isNaN(mGord) || mGord < 0 || mGord > 500) {
                  return res.status(400).json({ error: 'Gorduras da refeição inválidas.' });
                }

                const foods = meal.alimentos;
                if (foods !== undefined) {
                  if (!Array.isArray(foods)) {
                    return res.status(400).json({ error: 'alimentos deve ser um array.' });
                  }
                  if (foods.length > 22) {
                    return res.status(400).json({ error: `A refeição "${mealName}" não pode ter mais de 22 alimentos.` });
                  }
                  
                  for (const food of foods) {
                    const foodName = food.nome?.trim();
                    if (!foodName || foodName.length < 3 || foodName.length > 30) {
                      return res.status(400).json({ error: `O nome do alimento na refeição "${mealName}" deve ter entre 3 e 30 caracteres.` });
                    }
                    if (!nameRegex.test(foodName)) {
                      return res.status(400).json({ error: `O nome do alimento "${foodName}" não pode conter caracteres especiais.` });
                    }

                    const fGrams = Number(food.gramas || 0);
                    if (isNaN(fGrams) || fGrams < 1 || fGrams > 999) {
                      return res.status(400).json({ error: `O alimento "${foodName}" deve ter entre 1g e 999g.` });
                    }
                  }
                }
              }
            }
          }
        }
      }

      let dbWaterGoal = water_goal;
      // 3. Validate water_goal
      if (water_goal !== undefined) {
        let goal = Number(water_goal);
        if (goal > 0 && goal < 20) goal *= 1000; // migrate old Liters to ml
        if (isNaN(goal) || goal < 1000 || goal > 10000) {
          return res.status(400).json({ error: 'A meta de água deve estar entre 1000ml e 10000ml.' });
        }
        dbWaterGoal = goal / 1000; // Save as Liters to prevent DB overflow
      }

      // 4. Validate weight_goal
      if (weight_goal !== undefined && weight_goal !== null) {
        const goal = Number(weight_goal);
        if (isNaN(goal) || goal < 50.0 || goal > 130.0) {
          return res.status(400).json({ error: 'A meta de peso deve estar entre 50kg e 130kg.' });
        }
      }

      const { data, error } = await supabase
        .from('health_settings')
        .upsert({
          user_id: userId,
          ...(workout_weeks !== undefined && { workout_weeks }),
          ...(diet_config !== undefined && { diet_config }),
          ...(dbWaterGoal !== undefined && { water_goal: dbWaterGoal }),
          ...(weight_goal !== undefined && { weight_goal })
        })
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // Logs Endpoints
  static async logs(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { startDate } = req.query;
      let query = supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', userId)
        .order('data', { ascending: true }); // Ascending order helps with timecharts!

      if (startDate) {
        query = query.gte('data', startDate as string);
      }
      query = query.limit(2000);
      const { data, error } = await query;

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async listLogs(req: Request, res: Response) {
    return HealthController.logs(req, res);
  }

  static async log(req: Request, res: Response) {
    const { tipo, dados, data } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // Validations based on type
      if (!tipo || !['treino', 'peso', 'agua'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de log inválido. Valores aceitos: treino, peso, agua.' });
      }

      const logData = dados || {};
      const targetDate = data || new Date().toISOString().split('T')[0];

      if (tipo === 'peso') {
        const peso = Number(logData.peso);
        if (isNaN(peso) || peso < 40 || peso > 300) {
          return res.status(400).json({ error: 'O peso deve estar entre 40kg e 300kg.' });
        }

        // Limit of 2 logs per day
        const { data: existing, error: countErr } = await supabase
          .from('health_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('tipo', 'peso')
          .eq('data', targetDate);

        if (countErr) throw countErr;
        if (existing && existing.length >= 2) {
          return res.status(400).json({ error: 'Limite atingido: máximo de 2 registros de peso por dia.' });
        }
      }

      if (tipo === 'agua') {
        let quantidade = Number(logData.quantidade);
        if (quantidade > 0 && quantidade < 20) quantidade *= 1000; // migrate old Liters
        
        if (isNaN(quantidade) || quantidade < 0 || quantidade > 8000) {
          return res.status(400).json({ error: 'A quantidade total de água diária não pode ultrapassar 8000ml.' });
        }

        // Validate incremental addition constraint (50ml to 1000ml)
        const { data: existingWater } = await supabase
          .from('health_logs')
          .select('id, dados_json')
          .eq('user_id', userId)
          .eq('tipo', 'agua')
          .eq('data', targetDate)
          .maybeSingle();

        let prev = 0;
        if (existingWater && existingWater.dados_json) {
          prev = Number((existingWater.dados_json as any).quantidade) || 0;
          if (prev > 0 && prev < 20) prev *= 1000;
        }

        const diff = quantidade - prev;
        if (diff > 0 && (diff < 50 || diff > 1000)) {
          return res.status(400).json({ error: 'Cada adição de água deve ser entre 50ml e 1000ml.' });
        }

        logData.quantidade = quantidade; // Store safely in ml

        // For water, we can upsert or accumulate. If we save daily, let's keep one entry per day or update the existing one.
        const { data: existing, error: fetchErr } = await supabase
          .from('health_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('tipo', 'agua')
          .eq('data', targetDate)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (existing) {
          const { data: updated, error: updateErr } = await supabase
            .from('health_logs')
            .update({ dados_json: logData })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateErr) throw updateErr;
          return res.json({
            message: 'Registro de água atualizado com sucesso!',
            log: updated
          });
        }
      }

      // If tipo === 'treino', check for existing entry on that date so we don't duplicate gym entries
      if (tipo === 'treino') {
        const { data: existing, error: fetchErr } = await supabase
          .from('health_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('tipo', 'treino')
          .eq('data', targetDate)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (existing) {
          const { data: updated, error: updateErr } = await supabase
            .from('health_logs')
            .update({ dados_json: logData })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateErr) throw updateErr;
          return res.json({
            message: 'Registro de treino atualizado com sucesso!',
            log: updated
          });
        }
      }

      // Insert new log
      const { data: healthLog, error } = await supabase
        .from('health_logs')
        .insert({
          user_id: userId,
          tipo,
          dados_json: logData,
          data: targetDate
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({
        message: 'Registro de saúde salvo com sucesso!',
        log: healthLog
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async createLog(req: Request, res: Response) {
    return HealthController.log(req, res);
  }

  static async deleteLog(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { error } = await supabase
        .from('health_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Security: check ownership

      if (error) throw error;
      res.json({ message: `Registro de saúde ${id} excluído com sucesso.` });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
