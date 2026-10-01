import { validateRequest } from '../middlewares/validate.middleware';
import { taskSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { TasksController } from '../controllers/tasks.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all task endpoints with JWT verification
router.use(authMiddleware);

router.get('/', TasksController.list);
router.post('/', validateRequest(taskSchema), TasksController.create);
router.patch('/:id', validateRequest(taskSchema), TasksController.update);
router.delete('/:id', TasksController.delete);
router.post('/:id/complete', TasksController.complete);

export default router;
