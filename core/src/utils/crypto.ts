import crypto from 'crypto';
import * as argon2 from 'argon2';

const JWT_SECRET: string = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
}

export type TokenType = 'access' | 'refresh' | 'onboarding';
const TTL: Record<TokenType, number> = { access: 15 * 60, refresh: 15 * 24 * 3600, onboarding: 15 * 60 };

// Chave derivada por tipo: mesmo se alguém esquecer de checar `typ`, a assinatura não bate.
const keyFor = (typ: TokenType) =>
  crypto.createHmac('sha256', JWT_SECRET).update(`minsq:jwt:${typ}`).digest();

function sign(typ: TokenType, payload: object): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, typ, iat: now, exp: now + TTL[typ] })).toString('base64url');
  const sig = crypto.createHmac('sha256', keyFor(typ)).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export const signAccessToken = (p: object) => sign('access', p);
export const signRefreshToken = (p: object, jti: string) => sign('refresh', { ...p, jti });
export const signOnboardingToken = (email: string, sfp: string) => sign('onboarding', { pendingEmail: email, sfp });
export const fingerprint = (s?: string | null) => crypto.createHash('sha256').update(s ?? '').digest('hex');

// Identifica UMA linha de `pendente` de forma estável. Não pode depender de campos que o
// fluxo altera (código, expiração): o verifyEmail zera esses campos depois de assinar o token.
export const pendingFingerprint = (p: { id: string; email: string; created_at?: string | null }) =>
  fingerprint(`${p.id}|${p.email}|${p.created_at ?? ''}`);

// O 2º parâmetro é obrigatório: ninguém consegue "esquecer" o tipo.
export function verifyToken(token: string, expected: TokenType): any | null {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const exp = crypto.createHmac('sha256', keyFor(expected)).update(`${header}.${body}`).digest('base64url');
    const a = Buffer.from(signature), b = Buffer.from(exp);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.typ !== expected) return null;
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch { return null; }
}

/**
 * Hashes a session token for secure database storage using Argon2id
 */
export async function hashSessionToken(token: string): Promise<string> {
  return argon2.hash(token, { type: argon2.argon2id });
}

/**
 * Verifies a session token against an Argon2id hash
 */
export async function verifySessionToken(hash: string, token: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, token);
  } catch (err) {
    return false;
  }
}

/**
 * Hashes a password using Argon2id (Secure default)
 */
export async function hashPasswordArgon2(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Verifies a password against an Argon2id hash
 */
export async function verifyPasswordArgon2(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}
const ENCRYPTION_KEY = Buffer.from(crypto.hkdfSync('sha256', JWT_SECRET, Buffer.alloc(0), 'minsq-session-encryption', 32));

/**
 * Encrypts data symmetrically using authenticated encryption (AES-256-GCM)
 */
export function encryptSymmetric(text: string): string {
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

/**
 * Decrypts symmetrically encrypted data with authentication
 */
export function decryptSymmetric(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}
