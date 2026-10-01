import { Router } from 'express';
import crypto from 'crypto';
import passport from 'passport';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireTurnstile } from '../middlewares/turnstile.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { tokenSchema, codeSchema, emailSchema } from '../schemas/auth.schema';
import { isDev } from '../config/env';
import { 
  requestCodeLimiter,
  verifyEmailLimiter,
  sessionIpLimiter,
  googleAuthLimiter 
} from '../middlewares/rateLimit.middleware';

const router = Router({ mergeParams: true });

router.post('/logout', validateRequest(tokenSchema), sessionIpLimiter, AuthController.logout);
router.post('/logout-all', authMiddleware, sessionIpLimiter, AuthController.logoutAll);
router.post('/refresh', validateRequest(tokenSchema), sessionIpLimiter, AuthController.refresh);
router.post('/verify-email', validateRequest(codeSchema), requireTurnstile('verify-email'), verifyEmailLimiter, AuthController.verifyEmail);
router.post('/request-code', validateRequest(emailSchema), requireTurnstile('request-code'), requestCodeLimiter, AuthController.requestCode);
router.post('/cleanup-pendente', sessionIpLimiter, AuthController.cleanupPendente);
router.all('/revoke-suspicious', sessionIpLimiter, AuthController.revokeSuspicious);
router.get('/turnstile-key', AuthController.getTurnstileKey);

router.get('/google', googleAuthLimiter, (req, res, next) => {
  // O nonce amarra o OTC ao navegador e também gera o `state` do OAuth (ver config/oauthState.ts).
  const nonce = crypto.randomBytes(32).toString('hex');
  (req as any).gNonce = nonce;
  res.cookie('g_nonce', nonce, {
    httpOnly: true, secure: !isDev,
    sameSite: 'lax', path: '/api/auth', maxAge: 5 * 60 * 1000,
  });
  next();
}, passport.authenticate('google', { scope: ['email'] }));
router.get('/google/callback', googleAuthLimiter, (req, res, next) => {
  passport.authenticate('google', { session: false }, (err: any, user: any) => {
    if (err || !user) {
      console.error('[Google Callback] Erro de autenticação:', err?.message || 'sem usuário');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/pages/auth/google-close.html?error=auth_failed`);
    }
    req.user = user;
    return AuthController.googleCallback(req, res);
  })(req, res, next);
});
router.post('/verify-otc', googleAuthLimiter, AuthController.exchangeGoogleOtc);

export default router;
