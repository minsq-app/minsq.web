import { validateRequest } from '../middlewares/validate.middleware';
import { focusSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { FocusController } from '../controllers/focus.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

import { z } from 'zod';

const folderSchema = z.object({
  name: z.string().trim().min(3).max(48)
}).strict();

const routineSchema = z.object({
  name: z.string().trim().min(3).max(46),
  durationMin: z.number().min(0).max(1080).optional(),
  folderId: z.string().uuid().optional().nullable(),
  exercises: z.array(z.record(z.string(), z.any())).min(1).max(12)
    .refine(v => JSON.stringify(v).length < 20000, 'Payload grande demais')
}).strict();

// Protect all focus routes
router.use(authMiddleware);

router.post('/sessions', validateRequest(focusSchema), FocusController.log);
router.get('/stats', FocusController.stats);

// Folders (Pastas)
router.get('/folders', FocusController.getFolders);
router.post('/folders', validateRequest(folderSchema), FocusController.createFolder);
router.delete('/folders/:id', FocusController.deleteFolder);

// Routines (Rotinas de Foco/Fitness)
router.get('/routines', FocusController.getRoutines);
router.post('/routines', validateRequest(routineSchema), FocusController.createRoutine);
router.delete('/routines/:id', FocusController.deleteRoutine);

export default router;
