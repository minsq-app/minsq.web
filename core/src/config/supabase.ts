import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the .env file in the root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL or Service Key is missing in environmental variables.');
}

// Create the admin client which bypasses Row Level Security (RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

console.log('[Supabase] Client initialized successfully.');

export let existingColumns: string[] = [
  'id', 'email', 'nome', 'role', 'streak',
  'avatar_url', 'bio', 'tema', 'criado_em', 'ativo', 'senha',
  'nascimento', 'verification_code', 'verification_code_expires_at',
  'handle', 'social1', 'social2', 'profile_page_bg', 'profile_page_bg_img',
  'profile_kout', 'profile_font', 'profile_bg', 'profile_bg_opacity', 'profile_page_bg_opacity',
  'code_attempts', 'code_resends', 'code_last_sent_at',
  'avatar_border', 'profile_theme', 'avatar_type', 'avatar',
  'account_number', 'customization_json', 'banido', 'suspeito', 'shadowban',
  'perfil_publico', 'seguidores_count', 'seguindo_count',
  'estado', 'cidade', 'genero',
  'pwd_attempts', 'pwd_block_until', 'pwd_changes_count', 'pwd_changes_month',
  'conheceu_por', 'known_locations'
];

async function detectColumns() {
  try {
    const { data } = await supabase.from('users').select('*').limit(1);
    if (data && data[0]) {
      const detected = Object.keys(data[0]);
      existingColumns = Array.from(new Set([...existingColumns, ...detected]));
      console.log('[Supabase] Detected users columns merged:', existingColumns);
    } else {
      // Fallback: fetch OpenAPI schema
      const res = await (globalThis as any).fetch(supabaseUrl + '/rest/v1/', {
        headers: {
          'apikey': supabaseServiceKey!,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });
      const schema = await res.json();
      if (schema.definitions && schema.definitions.users) {
        existingColumns = Object.keys(schema.definitions.users.properties);
        console.log('[Supabase] Detected users columns from OpenAPI:', existingColumns);
      }
    }
  } catch (err: any) {
    console.warn('[Supabase] Failed to detect users columns, using defaults:', err.message);
  }
}

detectColumns();

export function filterUserFields(fieldsString: string): string {
  // '*' is a safe Supabase/PostgREST wildcard — pass it through as-is
  if (fieldsString.trim() === '*') return '*';

  return fieldsString
    .split(',')
    .map(f => f.trim())
    .filter(f => {
      // Block PostgREST embed/join syntax: campo(col1, col2) or nested.field
      if (f.includes('(') || f.includes(')') || f.includes('.')) return false;
      return existingColumns.includes(f);
    })
    .join(', ');
}

export function filterUserPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const clean: any = {};
  for (const key of Object.keys(payload)) {
    if (existingColumns.includes(key)) {
      clean[key] = payload[key];
    }
  }
  return clean;
}

export function formatUser(user: any): any {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    streak: user.streak,

    avatar_url: user.avatar_url,
    bio: user.bio,
    tema: user.tema || 'default',
    criado_em: user.criado_em,
    ativo: user.ativo,
    nascimento: user.nascimento,
    banido: user.banido,
    shadowban: user.shadowban,
    suspeito: user.suspeito,
    
    // Defaults e formatações
    handle: user.handle || ('@' + (user.nome || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15)),

    avatar: user.avatar || (user.nome ? user.nome[0] : 'U'),
    avatar_type: user.avatar_type || 'initial',
    avatar_border: user.avatar_border || 'none',
    profile_theme: user.profile_theme || 'default',
    profile_page_bg: user.profile_page_bg || 'default',
    profile_page_bg_img: user.profile_page_bg_img || '',
    profile_kout: user.profile_kout || 'none',
    profile_font: user.profile_font || 'dmsans',
    profile_bg: user.profile_bg || '',
    profile_bg_opacity: user.profile_bg_opacity ?? 30,
    profile_page_bg_opacity: user.profile_page_bg_opacity ?? 18,
    social1: user.social1 || '',
    social2: user.social2 || '',
    account_number: user.account_number || 0,
    customization_json: user.customization_json || null,

    perfil_publico: user.perfil_publico !== false,
    seguidores_count: user.seguidores_count ?? 0,
    seguindo_count: user.seguindo_count ?? 0,
    
    estado: user.estado || null,
    cidade: user.cidade || null,
    genero: user.genero || null,
    rotina_preset: user.rotina_preset || 1
  };
}

