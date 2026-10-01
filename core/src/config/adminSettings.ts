import { supabase } from './supabase';

export interface AdminSettings {
  registro_aberto: boolean;
  senha_forte: boolean;
  validar_email: boolean;
  botao_admin: boolean;
  dominios_permitidos: string[];
}

export let adminSettings: AdminSettings = {
  registro_aberto: true,
  senha_forte: false,
  validar_email: true,
  botao_admin: true,
  dominios_permitidos: []
};

export function getAdminSettings() {
  return adminSettings;
}

export async function initializeAdminSettings() {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'admin_settings')
      .maybeSingle();

    if (error) {
      console.warn('[AdminSettings] Error querying system_config for admin_settings.', error.message);
      return;
    }

    if (data && typeof data.value === 'object') {
      adminSettings = { ...adminSettings, ...data.value };
    }
    console.log(`[AdminSettings] Initialized from DB.`);
  } catch (err: any) {
    console.warn('[AdminSettings] Failed to initialize from DB:', err.message);
  }
}

export async function updateAdminSettings(newSettings: Partial<AdminSettings>) {
  try {
    const updated = { ...adminSettings, ...newSettings };
    const { error } = await supabase
      .from('system_config')
      .upsert({
        key: 'admin_settings',
        value: updated
      });

    if (error) throw error;
    adminSettings = updated;
    return true;
  } catch (err: any) {
    console.error('[AdminSettings] Failed to update in DB:', err.message);
    throw err;
  }
}

// Recarrega as configurações a cada 60 segundos
setInterval(initializeAdminSettings, 60000);
