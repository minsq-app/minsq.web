import { validateRequest } from '../middlewares/validate.middleware';
import { financeSettingsSchema } from '../schemas/secondary.schema';
import { Router } from 'express';
import { FinanceSettingsController } from '../controllers/finance-settings.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all settings endpoints
router.use(authMiddleware);

router.get('/', FinanceSettingsController.get);
router.post('/', validateRequest(financeSettingsSchema), FinanceSettingsController.upsert);

export default router;
