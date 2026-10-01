import crypto from 'crypto';
import { isDev } from '../config/env';
import { Request, Response } from 'express';
import { supabase, filterUserFields, filterUserPayload, formatUser, existingColumns } from '../config/supabase';
import { hashPasswordArgon2, verifyPasswordArgon2, signAccessToken, signRefreshToken, signOnboardingToken, verifyToken, hashSessionToken, verifySessionToken, fingerprint, pendingFingerprint, encryptSymmetric, decryptSymmetric } from '../utils/crypto';
import { invalidateAuthCache } from '../middlewares/auth.middleware';
import { normalizeEmail, findByEmail } from '../utils/email';

export async function createSession(userId: string, payload: any, req: Request, res: Response) {
  const sessionId = crypto.randomUUID();
  payload.sessionId = sessionId;
  const token = signAccessToken(payload);
  const refresh_token = signRefreshToken(payload, sessionId);
  const maxAgeMs = 15 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAgeMs).toISOString();

  const ip = req.ip || req.socket?.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (ip && userAgent) {
    await supabase.from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('ip_address', ip)
      .eq('user_agent', userAgent)
      .is('revoked_at', null);
  }

  await supabase.from('sessions').insert({
    id: sessionId,
    user_id: userId,
    refresh_token_hash: await hashSessionToken(refresh_token),
    expires_at: expiresAt,
    ip_address: ip,
    user_agent: userAgent
  });

  // Limite de 4 sessões simultâneas (Device Limit)
  const { data: activeSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (activeSessions && activeSessions.length > 4) {
    const sessionsToRevoke = activeSessions.slice(4).map((s: any) => s.id);
    await supabase.from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .in('id', sessionsToRevoke);
    console.log(`[Device Limit] Revogadas ${sessionsToRevoke.length} sessões antigas do usuário ${userId}`);
  }

  res.cookie('refresh_token', refresh_token, {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs
  });

  if (ip && userAgent) {
    // Analytics/IP tracking could go here, but suspicious login email was removed
  }

  return { token };
}

// Suspicious login email logic removed by request

// OTC store para Google OAuth (evita problemas de cookie cross-origin no Brave)
const googleOtcStore = new Map<string, { token: string, refreshToken: string, expiresAt: number, nonceHash?: string, user?: any }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of googleOtcStore.entries()) {
    if (v.expiresAt < now) googleOtcStore.delete(k);
  }
}, 60_000);

// Chutes errados (somando TODOS os IPs) que o código atual aguenta antes de ser invalidado.
// A vítima não fica travada: basta pedir outro código.
const MAX_CODE_FAILURES = 10;

/**
 * Conta uma tentativa por (ip|email) de forma ATÔMICA (função SQL, migration 015).
 * Fail-closed: se o banco falhar, devolve null e o chamador recusa a requisição.
 */
async function incrementCodeAttempt(ipEmail: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('increment_code_attempt', { p_key: ipEmail });
  if (error || typeof data !== 'number') {
    console.error('[CodeAttempt] RPC increment_code_attempt falhou (migration 015 aplicada?):', error?.message);
    return null;
  }
  return data;
}

/** Conta um chute errado no código da CONTA (independe de IP). Migration 015. */
async function bumpCodeFailures(table: 'users' | 'pendente', id: string): Promise<number> {
  const { data, error } = await supabase.rpc('bump_code_failures', { p_table: table, p_id: id });
  if (error || typeof data !== 'number') {
    console.error('[CodeAttempt] RPC bump_code_failures falhou:', error?.message);
    return 0; // o limite por ip|email continua valendo
  }
  return data;
}

/**
 * Invalida o código atual. Em `pendente` as colunas são NOT NULL, então expira em vez de zerar
 * (o UPDATE com null era recusado pelo banco e o código continuava valendo).
 */
async function invalidateVerificationCode(table: 'users' | 'pendente', id: string, resetAttempts = false) {
  const patch: any = table === 'pendente'
    ? { verification_code_expires_at: new Date(0).toISOString() }
    : { verification_code: null, verification_code_expires_at: null };
  if (resetAttempts) patch.code_attempts = 0;
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) console.error(`[CodeAttempt] Falha ao invalidar código em ${table}:`, error.message);
}

// Hash descartável para gastar o mesmo tempo de Argon2 quando a conta/código não existe.
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = () => (dummyHashPromise ??= hashPasswordArgon2(crypto.randomBytes(8).toString('hex')));

const escHtml = (str: unknown) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function clearCodeAttempt(ipEmail: string) {
  await supabase.from('code_attempts').delete().eq('ip_email', ipEmail);
}

function generateAlphanumericCode(length: number = 6): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(chars.length));
  }
  return result;
}

import { getAdminSettings } from '../config/adminSettings';

export class AuthController {


  static async verifyEmail(req: Request, res: Response) {
    const rawEmail = req.body?.email;
    const email = normalizeEmail(rawEmail);
    const code = String(req.body?.code ?? '');
    // Mesma mensagem para: e-mail inexistente, sem código pendente, expirado ou errado.
    const GENERIC = 'Código de verificação inválido ou expirado.';
    try {
      const ip = (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
      const ipEmail = `${ip}|${email}`;

      // A tentativa é contada ANTES de consultar o banco: a conta existindo ou não, o custo é o mesmo.
      const attempts = await incrementCodeAttempt(ipEmail);
      if (attempts === null) {
        return res.status(503).json({ error: 'Serviço indisponível no momento. Tente novamente em instantes.' });
      }

      if (attempts >= 5) {
        const lockoutIndex = Math.min(attempts - 5, 4); // 0..4
        const lockoutsMs = [30_000, 60_000, 120_000, 300_000, 900_000]; // 30s, 1m, 2m, 5m, 15m
        res.setHeader('Retry-After', String(lockoutsMs[lockoutIndex] / 1000));
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
      }

      const invalid = () => res.status(400).json({ error: GENERIC, ...(attempts >= 3 ? { captchaRequired: true } : {}) });

      let isPending = false;
      let user = await findByEmail('users', rawEmail);
      if (!user) {
        const pendente = await findByEmail('pendente', rawEmail);
        if (pendente) { user = pendente; isPending = true; }
      }
      const targetTable: 'users' | 'pendente' = isPending ? 'pendente' : 'users';

      const usable = !!user && !!user.verification_code && !!user.verification_code_expires_at &&
        new Date(user.verification_code_expires_at) >= new Date();

      if (!usable) {
        await verifyPasswordArgon2(await getDummyHash(), code); // equaliza o tempo de resposta
        return invalid();
      }

      const isValid = await verifyPasswordArgon2(user.verification_code, code);
      if (!isValid) {
        // Teto por conta, somando todos os IPs: passou do limite, o código morre e a vítima pede outro.
        const failures = await bumpCodeFailures(targetTable, user.id);
        if (failures >= MAX_CODE_FAILURES) {
          await invalidateVerificationCode(targetTable, user.id);
          return res.status(400).json({ error: 'Muitas tentativas falhas. O código foi invalidado por segurança. Solicite um novo código.' });
        }
        return invalid();
      }

      // Código correto: só agora revelamos banido/desativado (antes isso virava oráculo de existência).
      if (!isPending && user.banido) {
        return res.status(403).json({ error: 'Conta banida.' });
      }
      if (!isPending && user.ativo === false) {
        return res.status(403).json({ error: 'Conta desativada.' });
      }

      await clearCodeAttempt(ipEmail);

      if (isPending) {
        await invalidateVerificationCode('pendente', user.id, true);

        // O fingerprint identifica a linha pendente (id + created_at), não o código/expiração,
        // que acabamos de invalidar. O onboarding recalcula a mesma coisa.
        const onboardingToken = signOnboardingToken(user.email, pendingFingerprint(user));

        return res.json({ 
          message: 'E-mail verificado com sucesso!', 
          isNewUser: true, 
          pendingAuth: true, 
          onboardingToken 
        });
      }

      // Existing user in users table
      const { data: updatedUser, error: updateError } = await (supabase
        .from('users')
        .update({ 
          verification_code: null, 
          verification_code_expires_at: null, 
          code_attempts: 0
        })
        .eq('id', user.id)
        .select(filterUserFields('*'))
        .single() as any);

      if (updateError) throw updateError;

      const payload = { id: updatedUser.id, email: updatedUser.email };
      const { token } = await createSession(updatedUser.id, payload, req, res);

      res.json({
        message: 'E-mail verificado com sucesso!',
        token,
        user: formatUser(updatedUser)
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }



  static async cleanupPendente(req: Request, res: Response) {
    try {
      // Endpoint que pode ser chamado por um CronJob (ex: Vercel Cron ou GitHub Actions)
      // Pode ser protegido por um token no header
      // Fail-closed: sem CRON_SECRET o endpoint fica desligado (nada de segredo padrão).
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        console.error('[Limpeza] CRON_SECRET não configurado: endpoint desabilitado.');
        return res.status(503).json({ error: 'Endpoint indisponível.' });
      }
      const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      // Compara digests (tamanho fixo): não vaza o tamanho do segredo e usa tempo constante.
      const a = crypto.createHash('sha256').update(provided).digest();
      const b = crypto.createHash('sha256').update(secret).digest();
      if (!provided || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      // Calcula a data de 48 horas atrás
      const thresholdDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('pendente')
        .delete()
        .lt('created_at', thresholdDate)
        .select('id');

      if (error) throw error;

      console.log(`[Limpeza] CronJob executado: ${data?.length || 0} contas pendentes expiradas deletadas.`);
      return res.json({ message: 'Limpeza concluída com sucesso.', deletedCount: data?.length || 0 });
    } catch (err: any) {
      console.error('[Limpeza Error]', err);
      return res.status(500).json({ error: 'Erro interno ao limpar tabela pendente.' });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const refresh_token = req.cookies?.refresh_token;
      if (refresh_token) {
        const decoded = verifyToken(refresh_token, 'refresh');
        if (decoded && decoded.jti) {
          await supabase.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', decoded.jti);
          invalidateAuthCache({ sessionId: decoded.jti });
        }
      }
      res.clearCookie('refresh_token');
      res.json({ message: 'Sessão encerrada com sucesso.' });
    } catch (err: any) {
      console.error('[Logout Error]', err.message);
      // Mesmo dando erro no banco, limpamos os cookies pro usuário não ficar travado
      res.clearCookie('refresh_token');
      res.status(500).json({ error: 'Erro ao encerrar sessão.' });
    }
  }

  static async logoutAll(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }
      await supabase.from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('revoked_at', null);
      
      invalidateAuthCache({ userId });

      res.clearCookie('refresh_token');
      res.json({ message: 'Todas as sessões foram encerradas com sucesso.' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async refresh(req: Request, res: Response) {
    const refresh_token = req.cookies?.refresh_token;
    try {
      if (!refresh_token) {
        console.log('[Refresh] Falhou: Refresh token ausente.');
        return res.status(401).json({ error: 'Refresh token ausente.' });
      }

      const decoded = verifyToken(refresh_token, 'refresh');
      if (!decoded || !decoded.jti) {
        console.log('[Refresh] Falhou: Token JWT invalido/expirado.', decoded);
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
      }

      const { data: session } = await (supabase
        .from('sessions')
        .select('*')
        .eq('id', decoded.jti)
        .maybeSingle() as any);

      if (!session) {
        console.log('[Refresh] Falhou: Sessão não encontrada no DB. JTI:', decoded.jti);
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: 'Sessão não encontrada.' });
      }

      if (session.revoked_at || new Date(session.expires_at) < new Date()) {
        console.log('[Refresh] Falhou: Sessão expirada ou revogada no DB.', { revoked_at: session.revoked_at, expires: session.expires_at });
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: 'Sessão expirada ou revogada.' });
      }

      const isValid = await verifySessionToken(session.refresh_token_hash, refresh_token);
      if (!isValid) {
        // Antes de revogar, verifica se é uma corrida legítima (grace period)
        // Ex: shell + iframe disparando refresh concorrente ou múltiplas abas.
        // Se o token foi rotacionado há menos de 10s, devolve o último access token emitido.
        const GRACE_PERIOD_MS = 10_000;
        const lastRotated = (session as any).last_rotated_at
          ? new Date((session as any).last_rotated_at).getTime()
          : 0;

        const prevHash = (session as any).previous_token_hash;
        const isPrevious = prevHash ? await verifySessionToken(prevHash, refresh_token) : false;

        if (isPrevious && (Date.now() - lastRotated) < GRACE_PERIOD_MS && (session as any).last_new_access_token) {
          console.warn('[Auth] Grace period: corrida concorrente detectada, retornando token cacheado.');
          return res.json({ token: decryptSymmetric((session as any).last_new_access_token) });
        }

        // REUSE DETECTED: token antigo fora do grace period → sessão comprometida
        await supabase.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', decoded.jti);
        invalidateAuthCache({ sessionId: decoded.jti });
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: 'Token reutilizado. Sessão comprometida e revogada.' });
      }

      // Valid, rotate
      const { data: freshUser } = await supabase.from('users').select('role, banido, ativo').eq('id', decoded.id).maybeSingle();
      if (!freshUser || freshUser.banido || freshUser.ativo === false) {
        res.clearCookie('refresh_token');
        return res.status(401).json({ error: 'Sessão inválida.' });
      }
      const payload = { id: decoded.id, email: decoded.email, sessionId: decoded.jti };
      const newToken = signAccessToken(payload);
      const newRefreshToken = signRefreshToken(payload, decoded.jti);
      const newHash = await hashSessionToken(newRefreshToken);

      const { data: updatedSession, error: updateError } = await supabase
        .from('sessions')
        .update({
          refresh_token_hash: newHash,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          last_rotated_at: new Date().toISOString(),
          last_new_access_token: encryptSymmetric(newToken),
          previous_token_hash: session.refresh_token_hash
        })
        .eq('id', decoded.jti)
        .eq('refresh_token_hash', session.refresh_token_hash)
        .is('revoked_at', null)
        .select()
        .maybeSingle();

      if (updateError || !updatedSession) {
        // Perdeu a corrida de atualização otimista: outra requisição concorrente já rotacionou.
        // Busca o estado atual da sessão para checar o grace period.
        const { data: freshSession } = await supabase
          .from('sessions')
          .select('last_rotated_at, last_new_access_token, previous_token_hash')
          .eq('id', decoded.jti)
          .is('revoked_at', null)
          .maybeSingle();

        const GRACE_PERIOD_MS = 10_000;
        const lastRotated = (freshSession as any)?.last_rotated_at
          ? new Date((freshSession as any).last_rotated_at).getTime()
          : 0;

        const prevHash = (freshSession as any)?.previous_token_hash;
        const isPrevious = prevHash ? await verifySessionToken(prevHash, refresh_token) : false;

        if (isPrevious && (Date.now() - lastRotated) < GRACE_PERIOD_MS && (freshSession as any)?.last_new_access_token) {
          console.warn('[Auth] Grace period: conflito de rotação resolvido com token cacheado.');
          return res.json({ token: decryptSymmetric((freshSession as any).last_new_access_token) });
        }

        res.clearCookie('refresh_token');
        return res.status(401).json({ error: 'Conflito na rotação de sessão.' });
      }

      const maxAgeMs = 15 * 24 * 60 * 60 * 1000;
      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'lax',
    path: '/',
        maxAge: maxAgeMs
      });

      res.json({
        token: newToken
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
  static async googleCallback(req: Request, res: Response) {
    try {
      const user = req.user as any;
      if (!user) {
        console.error('[Google Callback] req.user vazio — autenticação falhou.');
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background:#070707"><script>window.close();</script></body></html>`);
      }
      if (!user._isPending && user.banido) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendUrl}/pages/auth/google-close.html?error=banned`);
      }
      if (!user._isPending && user.ativo === false) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          return res.redirect(`${frontendUrl}/pages/auth/google-close.html?error=deactivated`);
      }

      // Sem o nonce deste navegador não adianta criar sessão/OTC (evita sessão órfã no banco).
      const nonce = req.cookies?.g_nonce;
      if (!nonce) return res.status(400).send('Sessão de login expirada. Feche esta janela e tente de novo.');

      let token = '';
      if (user._isPending) {
        token = signOnboardingToken(user.email, pendingFingerprint(user));
        console.log(`[Google Callback] Usuário pendente. Gerado onboardingToken.`);
      } else {
        const payload = { id: user.id, email: user.email };
        const sessionRes = await createSession(user.id, payload, req, res);
        token = sessionRes.token;
      }

      const otc = crypto.randomBytes(16).toString('hex');
      googleOtcStore.set(otc, { 
        token, 
        refreshToken: '', 
        expiresAt: Date.now() + 30_000, 
        nonceHash: fingerprint(nonce),
        user: { 
          id: user.id, 
          email: user.email, 
          nome: user.nome, 
          avatar: user.avatar, 
          isNewUser: user._isNewUser,
          isPending: user._isPending
        } 
      });
      console.log(`[Google Callback] OTC criado. Store size: ${googleOtcStore.size}. Redirecionando...`);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/pages/auth/google-close.html#otc=${otc}`);
    } catch (err: any) {
      console.error('[Google Callback Error]', err);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/pages/auth/google-close.html?error=auth_failed`);
    }
  }

  static async exchangeGoogleOtc(req: Request, res: Response) {
    const otc = String(req.body?.otc || '');
    const nonce = req.cookies?.g_nonce;
    console.log(`[OTC Exchange] Requisição recebida. Store size: ${googleOtcStore.size}`);
    
    if (!otc || !nonce) return res.status(400).json({ error: 'Requisição inválida.' });

    const entry = googleOtcStore.get(otc);
    if (!entry || entry.expiresAt < Date.now()) {
      console.warn(`[OTC Exchange] OTC inválido ou expirado. entry=${!!entry}`);
      googleOtcStore.delete(otc);
      return res.status(401).json({ error: 'Código expirado ou inválido.' });
    }

    const a = Buffer.from(fingerprint(nonce));
    const b = Buffer.from(entry.nonceHash || '');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Código expirado ou inválido.' }); // NÃO consome o OTC
    }

    googleOtcStore.delete(otc);
    res.clearCookie('g_nonce', { path: '/api/auth' });
    console.log(`[OTC Exchange] Sucesso! Token retornado.`);

    if (entry.user.isPending) {
      return res.json({ pendingAuth: true, onboardingToken: entry.token });
    }

    // O Access Token é retornado via JSON e usado como Bearer no frontend.

    return res.json({ token: entry.token, user: entry.user, isNewUser: entry.user.isNewUser });
  }

  static async getTurnstileKey(req: Request, res: Response) {
    res.json({ siteKey: process.env.TURNSTILE_SITE_KEY || '' });
  }

  static async requestCode(req: Request, res: Response) {
    const email = normalizeEmail(req.body?.email);
    try {

      // Aceita e-mail normalizado e cru (contas antigas foram gravadas com ponto).
      const user = await findByEmail('users', req.body?.email);

      let isNewUser = false;
      if (!user) {
        isNewUser = true;
      }

      let pendenteUser = null;
      if (isNewUser) {
        pendenteUser = await findByEmail('pendente', req.body?.email);
        
        if (pendenteUser && pendenteUser.created_at) {
          const criadoEm = new Date(pendenteUser.created_at).getTime();
          const diffHours = (Date.now() - criadoEm) / (1000 * 60 * 60);
          if (diffHours >= 48) {
            console.log(`[Limpeza] Conta pendente expirada (>48h). Deletando...`);
            await supabase.from('pendente').delete().eq('id', pendenteUser.id);
            pendenteUser = null;
          }
        }
      }

      const targetUser = isNewUser ? pendenteUser : user;
      if (targetUser) {
        if (targetUser.code_last_sent_at) {
          const lastSent = new Date(targetUser.code_last_sent_at).getTime();
          const now = Date.now();
          const diffSec = Math.floor((now - lastSent) / 1000);
          
          if (diffSec < 60) {
            return res.status(429).json({ error: `Aguarde ${60 - diffSec} segundos antes de reenviar o código.` });
          }

          if (diffSec > 15 * 60) {
            targetUser.code_resends = 0;
          } else if (targetUser.code_resends >= 3) {
            return res.status(429).json({ error: 'Limite máximo de reenvios atingido. Tente novamente mais tarde.' });
          }
        }

        // Teto diário de envios por conta (A8)
        if (existingColumns.includes('daily_recovery_date')) {
          const today = new Date().toISOString().split('T')[0];
          const isSameDay = targetUser.daily_recovery_date && targetUser.daily_recovery_date.startsWith(today);
          const dailyCount = isSameDay ? (targetUser.daily_recovery_count || 0) : 0;

          if (dailyCount >= 10) {
            return res.status(429).json({ error: 'Limite diário de envio de códigos atingido. Tente novamente amanhã.' });
          }
        }
      }

      const recoveryCode = generateAlphanumericCode(6);
      const recoveryCodeHash = await hashPasswordArgon2(recoveryCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      if (isNewUser) {
        if (!pendenteUser) {
          const today = new Date().toISOString().split('T')[0];
          const insertPayload = {
            email,
            verification_code: recoveryCodeHash,
            verification_code_expires_at: expiresAt,
            ip_address: req.ip || req.socket?.remoteAddress,
            code_last_sent_at: new Date().toISOString(),
            code_resends: 0,
            code_attempts: 0,
            daily_recovery_date: today,
            daily_recovery_count: 1
          };
          const { error } = await supabase.from('pendente').insert(insertPayload);
          if (error) throw error;
        } else {
          const today = new Date().toISOString().split('T')[0];
          const isSameDay = pendenteUser.daily_recovery_date && pendenteUser.daily_recovery_date.startsWith(today);
          const dailyCount = isSameDay ? (pendenteUser.daily_recovery_count || 0) : 0;

          const updatePayload: any = { 
            verification_code: recoveryCodeHash, 
            verification_code_expires_at: expiresAt,
            code_last_sent_at: new Date().toISOString(),
            code_resends: (pendenteUser.code_resends || 0) + 1,
            code_attempts: 0,
            daily_recovery_date: today,
            daily_recovery_count: dailyCount + 1
          };
          const { error } = await supabase.from('pendente').update(updatePayload).eq('id', pendenteUser.id);
          if (error) throw error;
        }
      } else {
        const updatePayload: any = { 
          verification_code: recoveryCodeHash, 
          verification_code_expires_at: expiresAt
        };
        if (existingColumns.includes('code_last_sent_at')) {
          const today = new Date().toISOString().split('T')[0];
          const isSameDay = user.daily_recovery_date && user.daily_recovery_date.startsWith(today);
          const dailyCount = isSameDay ? (user.daily_recovery_count || 0) : 0;

          updatePayload.code_last_sent_at = new Date().toISOString();
          updatePayload.code_resends = (user.code_resends || 0) + 1;
          updatePayload.code_attempts = 0;
          updatePayload.daily_recovery_date = today;
          updatePayload.daily_recovery_count = dailyCount + 1;
        }

        const { error } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('id', user.id);
        if (error) throw error;
      }

      if (process.env.RESEND_API_KEY) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Minsq <no-reply@mohi.com.br>',
            to: email,
            subject: 'Seu código de acesso - Minsq',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Acesso à sua conta</h2>
                <p>Olá,</p>
                <p>Use o código de 6 dígitos abaixo para acessar sua conta:</p>
                <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                  <strong style="font-size: 24px; letter-spacing: 4px; color: #18181b;">${recoveryCode}</strong>
                </div>
                <p>Se você não solicitou isso, pode ignorar este e-mail em segurança.</p>
              </div>
            `
          })
        }).then(async r => { if (!r.ok) console.error('[Resend Error] status', r.status, await r.text().catch(() => '')); })
          .catch(err => console.error('[Resend Error]', err?.name === 'TimeoutError' ? 'timeout' : err));
      } else {
        console.warn(isDev ? `RESEND_API_KEY não configurada. O código gerado foi: ${recoveryCode}` : 'RESEND_API_KEY não configurada: e-mail não enviado.');
      }

      res.json({
        message: 'Código enviado para o seu e-mail.'
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async revokeSuspicious(req: Request, res: Response) {
    // `title`, `titleColor` e `body` são textos fixos daqui; qualquer dado vindo da requisição passa por escHtml.
    const buildPage = (icon: string, title: string, titleColor: string, body: string, confirm?: { session_id: string; user_id: string }) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Minsq</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;800&family=Quicksand:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      background: #0a0a0a;
      color: #e8e8e8;
      font-family: 'Quicksand', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    #particles-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
    }
    .card {
      position: relative;
      z-index: 1;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border-radius: 20px;
      padding: 52px 44px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 8px 60px rgba(0,0,0,0.6);
      animation: fadeUp 0.6s ease both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .icon { font-size: 52px; margin-bottom: 20px; display: block; }
    .title {
      font-family: 'Exo 2', sans-serif;
      font-size: 1.7rem;
      font-weight: 700;
      color: ${titleColor};
      margin-bottom: 14px;
    }
    .body-text {
      color: rgba(255,255,255,0.6);
      font-size: 0.95rem;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #7ecca6, #5bb89e);
      color: #0a0a0a;
      padding: 13px 28px;
      border-radius: 50px;
      font-family: 'Exo 2', sans-serif;
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      transition: opacity 0.2s, transform 0.2s;
    }
    .btn:hover { opacity: 0.85; transform: translateY(-2px); }
    .logo {
      font-family: 'Exo 2', sans-serif;
      font-size: 1.1rem;
      font-weight: 800;
      color: rgba(255,255,255,0.25);
      margin-bottom: 28px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div id="particles-bg"></div>
  <div class="card">
    <div class="logo">Minsq</div>
    <span class="icon">${icon}</span>
    <div class="title">${title}</div>
    <div class="body-text">${body}</div>
    ${confirm ? `<form method="POST" action="/api/auth/revoke-suspicious"><input type="hidden" name="session_id" value="${escHtml(confirm.session_id)}"><input type="hidden" name="user_id" value="${escHtml(confirm.user_id)}"><button type="submit" class="btn" style="background: linear-gradient(135deg, #d93838, #b82b2b); color: white;">Sim, Revogar Sessão</button></form>` : `<a href="/pages/auth/auth.html" class="btn">Ir para o Login</a>`}
  </div>
  <script>
    (function() {
      const container = document.getElementById('particles-bg');
      const W = container.clientWidth, H = container.clientHeight;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
      camera.position.z = 4;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(devicePixelRatio);
      container.appendChild(renderer.domElement);
      const N = 800;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 12;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0x7ecca6, size: 0.025, transparent: true, opacity: 0.5 });
      scene.add(new THREE.Points(geo, mat));
      let t = 0;
      (function animate() {
        requestAnimationFrame(animate);
        t += 0.001;
        scene.rotation.y = t * 0.3;
        scene.rotation.x = t * 0.15;
        renderer.render(scene, camera);
      })();
      window.addEventListener('resize', () => {
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
      });
    })();
  </script>
</body>
</html>`;

    try {
      const session_id = String(req.query.session_id || req.body?.session_id || '');
      const user_id = String(req.query.user_id || req.body?.user_id || '');
      
      // Só UUIDs: barra lixo/HTML antes de chegar no banco ou na página.
      if (!UUID_RE.test(session_id) || !UUID_RE.test(user_id)) {
        return res.status(400).send(buildPage('⚠️', 'Parâmetros Inválidos', '#e2c96e', 'O link que você usou é inválido ou está incompleto.<br>Verifique o e-mail de alerta e tente novamente.'));
      }

      // Busca a sessão
      const { data: session } = await supabase.from('sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user_id)
        .single();
        
      if (!session) {
        return res.status(404).send(buildPage('🔒', 'Sessão Não Encontrada', '#7ecca6', 'Esta sessão não foi encontrada ou já expirou.<br>Sua conta está segura.'));
      }

      // Se já foi revogada, avisa o usuário que já tá seguro
      if (session.revoked_at) {
        return res.send(buildPage('✅', 'Tudo Certo!', '#7ecca6', 'Esta sessão já havia sido desconectada e bloqueada anteriormente.<br>Sua conta está segura.'));
      }

      // Exige POST para realmente revogar (evita pre-fetch de scanner de email)
      if (req.method !== 'POST') {
        return res.send(buildPage('🛡️', 'Revogar Sessão?', '#e2c96e', 'Você tem certeza que deseja revogar este acesso desconhecido?<br>Isso desconectará o dispositivo suspeito imediatamente.', { session_id, user_id }));
      }

      // Revoga a sessão
      await supabase.from('sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session_id);
      invalidateAuthCache({ sessionId: session_id });

      // Adiciona na tabela suspects
      await supabase.from('suspects').insert({
        user_id: user_id,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        session_id: session_id
      });

      // Retorna uma página de confirmação amigável com o design do auth
      res.send(buildPage('🛡️', 'Dispositivo Desconectado!', '#7ecca6', 'O acesso suspeito foi bloqueado e o dispositivo foi deslogado com sucesso.<br><br>Se quiser, entre na sua conta e encerre também as outras sessões em Configurações.'));
      
    } catch (err: any) {
      console.error('[Revoke Suspicious Error]', err);
      res.status(500).send(buildPage('❌', 'Erro Interno', '#e25c5c', 'Ocorreu um erro ao tentar desconectar o dispositivo.<br>Tente novamente mais tarde.'));
    }
  }
}
