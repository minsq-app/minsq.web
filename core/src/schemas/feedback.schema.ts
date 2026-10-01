import { z } from 'zod';

const allowedDomains = ['gmail.com', 'icloud.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.com.br', 'hotmail.com.br'];

export const feedbackSchema = z.object({
  type: z.enum(['bug', 'sugestao', 'elogio', 'outro'], {
    message: 'Tipo de feedback inválido.'
  }),
  message: z.string().min(5, 'A mensagem deve ter pelo menos 5 caracteres.').max(300, 'A mensagem excede o limite de 300 caracteres.'),
  rating: z.number().min(1).max(5).optional().nullable(),
  email: z.union([
    z.string()
      .min(3, 'O e-mail deve ter no mínimo 3 caracteres.')
      .max(50, 'O e-mail deve ter no máximo 50 caracteres.')
      .email('Email inválido.')
      .refine(val => {
        const domain = val.split('@')[1];
        return allowedDomains.includes(domain?.toLowerCase());
      }, { message: 'Por favor, use um provedor de e-mail confiável (Ex: @gmail, @icloud, @outlook).' }),
    z.literal('')
  ]).optional()
});
