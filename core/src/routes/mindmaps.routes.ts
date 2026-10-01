import { validateRequest } from '../middlewares/validate.middleware';
import { mindmapSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { MindmapsController } from '../controllers/mindmaps.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all mindmaps routes
router.use(authMiddleware);

router.get('/', MindmapsController.list);
router.post('/', validateRequest(mindmapSchema), MindmapsController.create);
router.patch('/:map_id', validateRequest(mindmapSchema), MindmapsController.update);
router.delete('/:map_id', MindmapsController.delete);

export default router;
