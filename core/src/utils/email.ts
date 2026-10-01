import { supabase } from '../config/supabase';

/**
 * Normaliza e-mail para comparação/limites. Só o Gmail ignora pontos e +tag,
 * então só ele é reescrito; os outros provedores só passam por trim + lowercase.
 */
export function normalizeEmail(email: unknown): string {
  let str = String(email || '').trim().toLowerCase();
  if (!str.includes('@')) return str;
  
  let [local, domain] = str.split('@');
  
  // Strip +alias from the local part for all providers (Outlook, iCloud, Proton, etc)
  local = local.split('+')[0];

  // Only Gmail ignores dots in the local part
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }
  
  return `${local}@${domain}`;
}

/**
 * Formas pelas quais esse e-mail pode estar gravado no banco:
 * a normalizada (contas novas) e a crua em minúsculas (contas antigas, com ponto).
 */
export function emailCandidates(email: unknown): string[] {
  const raw = String(email || '').trim().toLowerCase();
  return Array.from(new Set([normalizeEmail(raw), raw].filter(Boolean)));
}

type Table = 'users' | 'pendente';

/**
 * Busca uma linha por e-mail aceitando as duas formas (normalizada e crua).
 * Se existirem duas, a normalizada ganha.
 */
export async function findByEmail(table: Table, email: unknown, columns = '*'): Promise<any | null> {
  const cands = emailCandidates(email);
  if (cands.length === 0) return null;
  const { data, error } = await (supabase.from(table).select(columns).in('email', cands).limit(2) as any);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const normalized = normalizeEmail(email);
  return data.find((r: any) => r.email === normalized) || data[0];
}
