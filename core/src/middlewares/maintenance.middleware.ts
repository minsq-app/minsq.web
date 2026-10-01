import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { supabase } from '../config/supabase';

// In-memory maintenance flag for rapid checks
export let isMaintenanceMode = false;
export let maintMessage = 'O sistema está em manutenção para melhorias. Por favor, tente novamente mais tarde.';
export let maintStartTime = '';
export let maintETA = '';

/**
 * Updates the in-memory maintenance mode flag.
 */
export function setMaintenanceMode(value: boolean, message?: string, startTime?: string, eta?: string) {
  isMaintenanceMode = value;
  if (message) maintMessage = message;
  if (startTime) maintStartTime = startTime;
  if (eta) maintETA = eta;
  console.log(`[MaintenanceMode] Flag updated in memory: ${isMaintenanceMode} (Start: ${maintStartTime} ETA: ${maintETA})`);
}

/**
 * Initializes maintenance mode from system_config DB table.
 */
export async function initializeMaintenanceMode() {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle();

    if (error) {
      console.warn('[MaintenanceMode] system_config table not found or error querying. Assuming false.', error.message);
      return;
    }

    if (data) {
      if (typeof data.value === 'boolean') {
        isMaintenanceMode = data.value;
      } else if (typeof data.value === 'string') {
        isMaintenanceMode = data.value === 'true';
      } else if (typeof data.value === 'object') {
        isMaintenanceMode = !!data.value.maintenance;
        if (data.value.message) maintMessage = data.value.message;
        if (data.value.startTime) maintStartTime = data.value.startTime;
        if (data.value.eta) maintETA = data.value.eta;
      }
    }
    console.log(`[MaintenanceMode] Initialized from DB: ${isMaintenanceMode} (ETA: ${maintETA})`);
  } catch (err: any) {
    console.warn('[MaintenanceMode] Failed to initialize from DB:', err.message);
  }
}

/**
 * Express middleware to block ALL requests (except status) when maintenance mode is active.
 * No admin bypass allowed.
 */
export function maintenanceMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const pathParts = req.baseUrl.split('/');
  const moduleName = pathParts[2] || ''; // /api/:module

  // Permitir apenas rota de status para o frontend saber quando a manutenção acabou
  if (moduleName === 'status') {
    return next();
  }

  if (isMaintenanceMode) {
    return res.status(503).json({
      error: maintMessage,
      startTime: maintStartTime,
      eta: maintETA,
      code: 'MAINTENANCE_MODE'
    });
  }

  next();
}
