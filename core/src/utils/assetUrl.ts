const HOSTS = (process.env.ASSET_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Puxa também a URL já configurada do Supabase para facilitar a sua vida (sem precisar criar variaveis extras no .env)
if (process.env.SUPABASE_URL) {
  try {
    HOSTS.push(new URL(process.env.SUPABASE_URL).hostname.toLowerCase());
  } catch (e) {}
}

// Garante que o host padrão do Minsq/Mohi seja aceito (opcional, fallback)
if (!HOSTS.includes('mohi.com.br')) HOSTS.push('mohi.com.br');

export function isOwnAssetUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:'
      && HOSTS.includes(u.hostname.toLowerCase())
      && u.pathname.startsWith('/storage/v1/object/public/uploads/');
  } catch { return false; }
}
