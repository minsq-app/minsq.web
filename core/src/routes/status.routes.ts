import { Router } from 'express';
import { StatusController } from '../controllers/status.controller';
import { statusLimiter } from '../middlewares/rateLimit.middleware';

const router = Router({ mergeParams: true });

router.get('/', statusLimiter, StatusController.getConfig);

export default router;
