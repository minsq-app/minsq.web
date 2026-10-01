import rateLimit from 'express-rate-limit';

import { normalizeEmail } from '../utils/email';
export { normalizeEmail };

// Gerador de chaves por e-mail para impedir brute force distribuído focado na conta.
const keyGeneratorByEmail = (req: any) => {
  if (req.body && req.body.email) {
    return normalizeEmail(req.body.email);
  }
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  return ip.replace(/^::ffff:/, '');
};

const emailIpKey = (req: any) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const cleanIp = ip.replace(/^::ffff:/, '');
  return `${cleanIp}|${normalizeEmail(req.body?.email)}`;
};

// 1. Limite geral da API
export const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 300, // 300 requisições
  message: { error: 'Muitas requisições automáticas detectadas. Acalme-se um pouco!' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Limite de Login (por IP)
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login neste IP. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Muitas tentativas de login com Google. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Limite de Login (por Conta/E-mail)
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  keyGenerator: emailIpKey,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas para esta conta. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

// 4. Limite de Registro (por IP)
export const registerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: { error: 'Muitos registros neste IP. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordLimiter = rateLimit({ windowMs: 3600_000, max: 5,  keyGenerator: emailIpKey, validate: false, standardHeaders: true, legacyHeaders: false });
export const requestCodeLimiter    = rateLimit({ windowMs: 3600_000, max: 5,  keyGenerator: emailIpKey, validate: false, standardHeaders: true, legacyHeaders: false });
export const validateCodeLimiter   = rateLimit({ windowMs: 900_000,  max: 10, keyGenerator: emailIpKey, validate: false, standardHeaders: true, legacyHeaders: false });
export const verifyEmailLimiter    = rateLimit({ windowMs: 900_000,  max: 10, keyGenerator: emailIpKey, validate: false, standardHeaders: true, legacyHeaders: false });

// (verifyAccountLimiter removido: a lógica de bloqueio de 5 falhas no código foi movida
// para o auth.controller.ts para não causar Lockout Destrutivo de 429 para a vítima)

// 6B. Limite de Perfil Público (por IP)
// A URL amigável (/?page=profile/@handle) torna esse endpoint mais fácil de
// descobrir e automatizar do que antes (link copiável, sem precisar estar logado).
// Um limite dedicado, mais apertado que o apiLimiter geral, reduz o risco de
// scraping em massa / enumeração de handles cadastrados.
export const publicProfileLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 60, // 60 lookups de perfil público por IP a cada 10 min
  message: { error: 'Muitas consultas de perfil. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const followActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 40,
  message: { error: 'Muitas ações de seguir em pouco tempo. Aguarde um instante.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 7. Limite de Refresh/Logout (por IP)
// Generoso, para não penalizar o uso da UI em múltiplas abas
export const sessionIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Muitas solicitações de sessão.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 8. Limite de Exploradores da API (por IP)
// Penaliza IPs que buscam rotas que não existem (Scanners / Bots)
export const apiExplorerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Max 20 requisições não encontradas ou inválidas
  message: { error: 'Detecção de varredura/exploração de API. Seu IP foi bloqueado temporariamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite específico para validação de Handle (Onboarding)
export const checkHandleLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // 60 requisições por minuto (suficiente para digitação real)
  message: { error: 'Muitas verificações de nome detectadas. Acalme-se um pouco!' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite específico para a rota de Status (Evitar DDoS durante manutenção)
export const statusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 requisições por minuto (1 a cada 2 segundos)
  message: { error: 'Calma, o sistema ainda está em manutenção. Atualizações excessivas bloqueadas.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  standardHeaders: true, legacyHeaders: false,
});
