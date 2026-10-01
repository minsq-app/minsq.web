import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Formato de e-mail inválido.').max(50, 'Máximo de 50 caracteres permitido.').regex(/@(gmail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|yahoo\.com)$/i, 'Provedor de e-mail não suportado.').transform(val => val.trim().toLowerCase()),
    password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/, 'A senha não atende aos requisitos de segurança.'),
    nome: z.string().min(2).max(100),
    nascimento: z.string().max(20),
  }).strict(),
  query: z.object({}).strict(),
  params: z.any(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Formato de e-mail inválido.').max(50, 'Máximo de 50 caracteres permitido.').regex(/@(gmail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|yahoo\.com)$/i, 'Provedor de e-mail não suportado.').transform(val => val.trim().toLowerCase()),
    password: z.string().min(1).max(128),
  }).strict(),
  query: z.object({}).strict(),
  params: z.any(),
});

export const tokenSchema = z.object({
  body: z.object({}).strict(),
  query: z.object({}).strict(),
  params: z.any(),
});

export const emailSchema = z.object({
  body: z.object({
    email: z.string().email('Formato de e-mail inválido.').max(50, 'Máximo de 50 caracteres permitido.').regex(/@(gmail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|yahoo\.com)$/i, 'Provedor de e-mail não suportado.').transform(val => val.trim().toLowerCase()),
    turnstileToken: z.string().optional(),
  }).strict(),
  query: z.object({}).strict(),
  params: z.any(),
});

export const codeSchema = z.object({
  body: z.object({
    email: z.string().email('Formato de e-mail inválido.').max(50, 'Máximo de 50 caracteres permitido.').regex(/@(gmail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com|yahoo\.com)$/i, 'Provedor de e-mail não suportado.').transform(val => val.trim().toLowerCase()),
    code: z.string().length(6, 'Código deve ter exatamente 6 caracteres.'),
    turnstileToken: z.string().optional(),
  }).strict(),
  query: z.object({}).strict(),
  params: z.any(),
});

export const updatePasswordSchema = z.object({
  body: z.object({
    senha_atual: z.string().min(1).max(128),
    password: z.string().min(8).max(50).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,}$/, 'A senha não atende aos requisitos de segurança.'),
  }).strict(),
  query: z.object({}).strict(),
  params: z.any(),
});
