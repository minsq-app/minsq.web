import { validateRequest } from '../middlewares/validate.middleware';
import { healthSettingsSchema, healthLogSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all health routes
router.use(authMiddleware);

router.get('/settings', HealthController.getSettings);
router.post('/settings', validateRequest(healthSettingsSchema), HealthController.saveSettings);
router.get('/logs', HealthController.listLogs);
router.post('/logs', validateRequest(healthLogSchema), HealthController.createLog);
router.delete('/logs/:id', HealthController.deleteLog);

export default router;
