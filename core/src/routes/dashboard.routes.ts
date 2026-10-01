import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Fetch dashboard consolidated statistics
router.get('/summary', authMiddleware, DashboardController.summary);

export default router;
