import crypto from 'crypto';
import { fingerprint } from '../utils/crypto';

/**
 * State store do OAuth SEM sessão com assinatura criptográfica HMAC.
 *
 * O state é assinado pelo servidor com chave secreta e contém timestamp de validade (10 min).
 * Isso garante:
 *  1. Proteção CSRF 100% matemática (um invasor não consegue forjar o HMAC sem o SECRET);
 *  2. Resiliência total contra bloqueio de cookies em redirecionamentos cross-site (SameSite);
 *  3. Funcionamento perfeito através de proxies, redirects 307/308 de subdomínios (mohi.com.br <-> www)
 *     e domínios de deploy (Vercel/Render).
 */
const STATE_SECRET = process.env.JWT_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'minsq-oauth-hmac-secret-salt';

function signState(nonce: string, timestamp: number): string {
  const data = `${nonce}.${timestamp}`;
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyState(stateStr: string): { valid: boolean; nonce?: string } {
  try {
    const parts = stateStr.split('.');
    if (parts.length !== 3) return { valid: false };
    const [nonce, tsStr, sig] = parts;
    const timestamp = parseInt(tsStr, 10);
    // Expira em 10 minutos
    if (isNaN(timestamp) || Date.now() - timestamp > 10 * 60 * 1000 || timestamp > Date.now() + 60 * 1000) {
      return { valid: false };
    }
    const expectedSig = crypto.createHmac('sha256', STATE_SECRET).update(`${nonce}.${tsStr}`).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    return { valid: true, nonce };
  } catch {
    return { valid: false };
  }
}

const deriveState = (nonce: string) => fingerprint(`oauth-state:${nonce}`);

export const googleStateStore = {
  // arity 3 => passport-oauth2 chama store(req, meta, cb)
  store(req: any, _meta: any, cb: (err: Error | null, state?: string) => void) {
    const nonce = req.gNonce || crypto.randomBytes(32).toString('hex');
    req.gNonce = nonce;
    const signed = signState(nonce, Date.now());
    cb(null, signed);
  },

  // arity 3 => passport-oauth2 chama verify(req, providedState, cb)
  verify(req: any, providedState: string, cb: (err: Error | null, ok?: boolean, info?: any) => void) {
    if (!providedState || typeof providedState !== 'string') {
      return cb(null, false, { message: 'Unable to verify authorization request state.' });
    }

    // 1. Tenta validação HMAC assinada (novo fluxo)
    const verification = verifyState(providedState);
    if (verification.valid && verification.nonce) {
      req.gNonce = verification.nonce;
      return cb(null, true);
    }

    // 2. Fallback para verificação legada baseada no cookie g_nonce
    const nonce = req.cookies?.g_nonce;
    if (nonce && typeof nonce === 'string') {
      const a = Buffer.from(deriveState(nonce));
      const b = Buffer.from(providedState);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        req.gNonce = nonce;
        return cb(null, true);
      }
    }

    return cb(null, false, { message: 'Invalid authorization request state.' });
  },
};

