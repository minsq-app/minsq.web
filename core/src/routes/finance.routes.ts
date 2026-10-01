import { validateRequest } from '../middlewares/validate.middleware';
import { financeSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all finance endpoints
router.use(authMiddleware);

router.get('/', FinanceController.list);
router.post('/', validateRequest(financeSchema), FinanceController.create);
router.get('/summary', FinanceController.summary);
router.get('/export', FinanceController.exportTxt);
router.patch('/:id', validateRequest(financeSchema), FinanceController.update);
router.delete('/:id', FinanceController.delete);

export default router;
