import crypto from 'crypto';
import { fingerprint } from '../utils/crypto';

/**
 * State store do OAuth SEM sessão.
 *
 * O `state: true` do passport-oauth2 exige `req.session` (express-session). Aqui o `state`
 * é derivado do cookie httpOnly `g_nonce`, que a rota /google já cria para amarrar o OTC
 * ao navegador. No callback, o `state` devolvido pelo Google tem que bater com o derivado do
 * cookie que ESTE navegador carrega — assim um callback forjado (login CSRF) não passa.
 *
 * Fluxo:
 *  - a rota /google gera o nonce, grava o cookie e deixa o valor em `req.gNonce`;
 *  - `store()` devolve o state derivado desse nonce;
 *  - `verify()` recalcula a partir do cookie e compara em tempo constante.
 */
const deriveState = (nonce: string) => fingerprint(`oauth-state:${nonce}`);

export const googleStateStore = {
  // arity 3 => passport-oauth2 chama store(req, meta, cb)
  store(req: any, _meta: any, cb: (err: Error | null, state?: string) => void) {
    const nonce = req.gNonce;
    if (!nonce || typeof nonce !== 'string') return cb(new Error('OAuth: nonce ausente.'));
    cb(null, deriveState(nonce));
  },

  // arity 3 => passport-oauth2 chama verify(req, providedState, cb)
  verify(req: any, providedState: string, cb: (err: Error | null, ok?: boolean, info?: any) => void) {
    const nonce = req.cookies?.g_nonce;
    if (!nonce || typeof nonce !== 'string' || !providedState || typeof providedState !== 'string') {
      return cb(null, false, { message: 'Unable to verify authorization request state.' });
    }
    const a = Buffer.from(deriveState(nonce));
    const b = Buffer.from(providedState);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return cb(null, false, { message: 'Invalid authorization request state.' });
    }
    cb(null, true);
  },
};
