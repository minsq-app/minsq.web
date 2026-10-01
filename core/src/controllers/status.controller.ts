import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { isMaintenanceMode, maintMessage, maintStartTime, maintETA } from '../middlewares/maintenance.middleware';

let cachedConfig: any = null;
let lastCacheTime: number = 0;
const CACHE_TTL = 30 * 1000; // 30 segundos

export class StatusController {
  static async getConfig(req: Request, res: Response) {
    try {
      const now = Date.now();

      // Se o cache for válido, retorna ele imediatamente
      if (cachedConfig && (now - lastCacheTime < CACHE_TTL)) {
        return res.json(cachedConfig);
      }

      // Busca dados frescos do banco
      const [
        { data: maintenances, error: errMain },
        { data: incidents, error: errInc },
        { data: notices, error: errNot }
      ] = await Promise.all([
        supabase.from('status_maintenances').select('*').order('scheduled_date', { ascending: true }),
        supabase.from('status_incidents').select('*').order('incident_date', { ascending: false }),
        supabase.from('status_notices').select('*').order('notice_date', { ascending: false })
      ]);

      if (errMain) console.error('Erro ao buscar maintenances:', errMain);
      if (errInc) console.error('Erro ao buscar incidents:', errInc);
      if (errNot) console.error('Erro ao buscar notices:', errNot);

      const config: any = {
        maintenances: maintenances || [],
        incidents: incidents || [],
        notices: notices || [],
        // Múltiplos dados de manutenção local (memória)
        isMaintenanceMode,
        maintMessage,
        maintStartTime,
        maintETA
      };

      // Atualiza o cache
      cachedConfig = config;
      lastCacheTime = now;

      return res.json(config);
    } catch (err: any) {
      console.error('[StatusController.getConfig] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
