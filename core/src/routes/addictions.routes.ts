import { validateRequest } from '../middlewares/validate.middleware';
import { addictionSchema, addictionUpdateSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { AddictionsController } from '../controllers/addictions.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all addictions routes
router.use(authMiddleware);

router.get('/', AddictionsController.list);
router.post('/', validateRequest(addictionSchema), AddictionsController.create);
router.patch('/:addiction_id', validateRequest(addictionUpdateSchema), AddictionsController.update);
router.delete('/:addiction_id', AddictionsController.delete);

export default router;
