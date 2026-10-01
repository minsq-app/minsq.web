import { Router } from 'express';
import { z } from 'zod';
import { BugsController } from '../controllers/bugs.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router({ mergeParams: true });

const bugSchema = z.object({
  titulo: z.string().min(1, 'Obrigatório').max(100, 'Máximo 100 caracteres'),
  descricao: z.string().min(1, 'Obrigatório').max(2000, 'Máximo 2000 caracteres'),
  logs: z.string().max(5000, 'Máximo 5000 caracteres').optional().nullable(),
  device_info: z.string().max(1000, 'Máximo 1000 caracteres').optional().nullable()
}).strict();

// Protect bug submission (or make it open if you want anonymous bugs, but authMiddleware ensures user_id is mapped)
router.post('/', authMiddleware, validateRequest(bugSchema), BugsController.create);

export default router;
