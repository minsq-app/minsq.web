import { z } from 'zod';

export const dmSchema = z.object({
  message: z.string().min(5, 'A mensagem deve ter pelo menos 5 caracteres.').max(200, 'A mensagem não pode passar de 200 caracteres.'),
  email: z.string().min(3, 'E-mail muito curto.').max(50, 'E-mail muito longo.').email('E-mail inválido.').optional().nullable()
});
