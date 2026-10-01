import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabase } from './supabase';
import crypto from 'crypto';
import { googleStateStore } from './oauthState';
import { normalizeEmail, findByEmail } from '../utils/email';

// Sem express-session: o `state` do OAuth vive num cookie httpOnly (ver oauthState.ts).
const strategyOptions: any = {
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  store: googleStateStore,
};

passport.use(new GoogleStrategy(strategyOptions,
  async function(_accessToken: string, _refreshToken: string, profile: any, cb: (err: any, user?: any) => void) {
    try {
      const rawEmail = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      if (!rawEmail) {
        return cb(new Error('No email found in Google profile'));
      }

      if (profile._json?.email_verified === false) return cb(new Error('E-mail do Google não verificado.'));

      // Mesma normalização do login por código (sem pontos/+tag no Gmail). Sem isso,
      // a.b@gmail.com viraria uma 2ª conta, diferente de ab@gmail.com.
      const email = normalizeEmail(rawEmail);

      // Procura pela forma normalizada E pela crua: contas antigas foram gravadas com ponto.
      const existingUser = await findByEmail('users', rawEmail);
      if (existingUser) {
        // Linha legada criada por /register com senha de terceiros e nunca confirmada: não reaproveitar.
        // (Linhas do fluxo novo não têm senha; a coluna `confirmado` pode ficar false nelas.)
        if (existingUser.confirmado === false && existingUser.senha) {
          return cb(new Error('Conta ainda não verificada.'));
        }
        return cb(null, existingUser);
      }

      // O Google provou a posse do e-mail: descarta qualquer cadastro pendente que alguém tenha deixado.
      await supabase.from('pendente').delete().in('email', Array.from(new Set([email, rawEmail.toLowerCase()])));

      // Novo usuário — cria em 'pendente'
      const dummyCode = crypto.randomBytes(16).toString('hex');
      const dummyExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { data: newUser, error } = await (supabase.from('pendente').insert({
        email,
        verification_code: dummyCode,
        verification_code_expires_at: dummyExpiresAt,
        code_last_sent_at: new Date().toISOString(),
        code_resends: 0,
        code_attempts: 0
      }).select().maybeSingle() as any);

      if (error || !newUser) {
        return cb(error || new Error('Falha ao criar cadastro pendente.'));
      }

      newUser._isPending = true;
      newUser._isNewUser = true;
      return cb(null, newUser);
    } catch (err: any) {
      return cb(err);
    }
  }
));

// Sem serializeUser/deserializeUser: não há sessão (o callback usa `session: false`).

export default passport;
