import { validateRequest } from '../middlewares/validate.middleware';
import { routineSchema, routineDeleteMultipleSchema, routinePresetSchema } from '../schemas/secondary.schema';
import { Router } from 'express';
import { RoutinesController } from '../controllers/routines.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, RoutinesController.list);
router.post('/', authMiddleware, validateRequest(routineSchema), RoutinesController.create);
router.put('/preset', authMiddleware, validateRequest(routinePresetSchema), RoutinesController.setPreset);
router.delete('/:id', authMiddleware, RoutinesController.delete);
router.post('/delete-multiple', authMiddleware, validateRequest(routineDeleteMultipleSchema), RoutinesController.deleteMultiple);

export default router;
