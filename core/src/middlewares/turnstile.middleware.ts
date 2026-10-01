import { Request, Response, NextFunction } from 'express';
import { isDev } from '../config/env';

/**
 * Valida o token do Cloudflare Turnstile.
 *
 * `expectedAction` amarra o token ao formulário que o gerou (o widget precisa ser renderizado
 * com `action: '<mesmo valor>'`). Sem isso, um token resolvido num formulário serve em outro.
 *
 * Transição: enquanto o front antigo não manda `action`, o Cloudflare devolve action vazio.
 * Por padrão esse caso é aceito (só rejeita action DIFERENTE). Depois de publicar o front novo,
 * defina TURNSTILE_REQUIRE_ACTION=true para exigir o action.
 */
export function requireTurnstile(expectedAction: string) {
  return async function turnstileMiddleware(req: Request, res: Response, next: NextFunction) {
    const { turnstileToken } = req.body || {};

    if (!isDev && !process.env.TURNSTILE_SECRET_KEY) {
      console.error('[Segurança] TURNSTILE_SECRET_KEY não configurada em produção!');
      return res.status(500).json({ error: 'Configuração de segurança ausente no servidor.' });
    }

    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken || typeof turnstileToken !== 'string') {
        return res.status(403).json({ error: 'Falha na validação de segurança (Turnstile ausente).' });
      }
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken,
            remoteip: req.ip || req.socket?.remoteAddress
          })
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
          console.warn('[Turnstile Failed]', verifyData);
          return res.status(403).json({ error: 'Validação de segurança falhou. Tente novamente.' });
        }

        const expectedHost = process.env.FRONTEND_URL ? new URL(process.env.FRONTEND_URL).hostname : null;
        if (!isDev && expectedHost && verifyData.hostname && verifyData.hostname !== expectedHost) {
          console.warn(`[Turnstile Hostname Mismatch] Esperado: ${expectedHost}, Recebido: ${verifyData.hostname}`);
          return res.status(403).json({ error: 'Origem da requisição inválida.' });
        }

        const gotAction: string = verifyData.action || '';
        const requireAction = process.env.TURNSTILE_REQUIRE_ACTION === 'true';
        if ((gotAction && gotAction !== expectedAction) || (!gotAction && requireAction)) {
          console.warn(`[Turnstile Action Mismatch] Esperado: ${expectedAction}, Recebido: ${gotAction || '(vazio)'}`);
          return res.status(403).json({ error: 'Validação de segurança falhou. Tente novamente.' });
        }
      } catch (err) {
        console.error('[Turnstile Error]', err);
        return res.status(500).json({ error: 'Erro interno ao validar segurança.' });
      }
    }

    next();
  };
}
