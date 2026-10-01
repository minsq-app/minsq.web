import { validateRequest } from '../middlewares/validate.middleware';
import { supportTicketSchema } from '../schemas/secondary.schema';
import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

import { requireTurnstile } from '../middlewares/turnstile.middleware';

// Rota de contato pública (não exige autenticação)
router.post('/contact', validateRequest(supportTicketSchema), requireTurnstile('contact'), SupportController.publicContact);

// Rotas de suporte privado do usuário (exigem token válido)
router.use(authMiddleware);
router.get('/tickets', SupportController.listTickets);
router.post('/tickets', validateRequest(supportTicketSchema), SupportController.createTicket);

export default router;
