import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/crypto';
import { supabase } from '../config/supabase';

export interface AuthenticatedRequest extends Request {
  userId?: string; userRole?: string; userEmail?: string; sessionId?: string;
}

type AuthState = { userId: string; reason?: 'BANNED' | 'INVALID'; role?: string; email?: string; ts: number };
const TTL = 10_000;
const cache = new Map<string, AuthState>(); // chave = sessionId
setInterval(() => { const n = Date.now(); for (const [k, v] of cache) if (n - v.ts > TTL) cache.delete(k); }, 60_000).unref();

// Chame nos pontos que revogam sessão para o efeito ser imediato (senão vale o TTL de 10s)
export function invalidateAuthCache(o: { sessionId?: string; userId?: string; exceptSessionId?: string }) {
  for (const [sid, v] of cache) {
    if (o.sessionId ? sid === o.sessionId : v.userId === o.userId && sid !== o.exceptSessionId) cache.delete(sid);
  }
}

async function loadState(userId: string, sessionId: string): Promise<AuthState> {
  const hit = cache.get(sessionId);
  if (hit && hit.userId === userId && Date.now() - hit.ts < TTL) return hit;

  const [s, u] = await Promise.all([
    supabase.from('sessions').select('user_id, revoked_at, expires_at').eq('id', sessionId).maybeSingle(),
    supabase.from('users').select('email, role, banido, ativo').eq('id', userId).maybeSingle(),
  ]);
  if (s.error || u.error) throw s.error || u.error;

  const session = s.data, user = u.data;
  let reason: AuthState['reason'];
  if (!user) reason = 'INVALID';                                   // usuário deletado
  else if (user.banido) reason = 'BANNED';
  else if (user.ativo === false) reason = 'INVALID';
  else if (!session || session.user_id !== userId || session.revoked_at ||
           new Date(session.expires_at) < new Date()) reason = 'INVALID'; // sessão revogada/expirada

  const state: AuthState = { userId, reason, role: user?.role, email: user?.email, ts: Date.now() };
  cache.set(sessionId, state);
  return state;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });

  const decoded = verifyToken(h.split(' ')[1], 'access');
  if (!decoded?.id || !decoded?.sessionId)
    return res.status(401).json({ error: 'Acesso negado. Token inválido ou expirado.' });

  let st: AuthState;
  try { st = await loadState(decoded.id, decoded.sessionId); }
  catch (e: any) {
    console.error('[authMiddleware] DB error:', e.message);
    return res.status(503).json({ error: 'Serviço indisponível no momento.' }); // falha fechada
  }
  if (st.reason === 'BANNED')
    return res.status(403).json({ error: 'Sua conta foi suspensa por violação dos termos de uso.', code: 'USER_BANNED' });
  if (st.reason)
    return res.status(401).json({ error: 'Sessão inválida ou revogada.', code: 'SESSION_REVOKED' });

  req.userId = decoded.id;
  req.userRole = st.role;      // role vem do banco, não do token
  req.userEmail = st.email;
  req.sessionId = decoded.sessionId;
  next();
}

export async function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next();
  const decoded = verifyToken(h.split(' ')[1], 'access');
  if (!decoded?.id || !decoded?.sessionId) return next();
  try {
    const st = await loadState(decoded.id, decoded.sessionId);
    if (!st.reason) {
      req.userId = decoded.id; req.userRole = st.role; req.userEmail = st.email; req.sessionId = decoded.sessionId;
    }
  } catch { /* segue anônimo */ }
  next();
}
