import { Router } from 'express';
import { DmController } from '../controllers/dm.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { dmSchema } from '../schemas/dm.schema';
import rateLimit from 'express-rate-limit';

const router = Router({ mergeParams: true });

const dmLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutos
  max: 3, // máximo de 3 mensagens por IP
  message: { error: 'Você enviou muitas mensagens. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', authMiddleware, dmLimiter, validateRequest(dmSchema), DmController.createDM);

export default router;
