import { validateRequest } from '../middlewares/validate.middleware';
import { planActionSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { PlansActionController } from '../controllers/plans_action.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware as any);

router.get('/', PlansActionController.list);
router.post('/', validateRequest(planActionSchema), PlansActionController.upsert);
router.delete('/:cat_id', PlansActionController.delete);

export default router;
