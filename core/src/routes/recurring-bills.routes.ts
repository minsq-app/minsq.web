import { validateRequest } from '../middlewares/validate.middleware';
import { recurringBillSchema } from '../schemas/secondary.schema';
import { Router } from 'express';
import { RecurringBillsController } from '../controllers/recurring-bills.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all recurring bills endpoints
router.use(authMiddleware);

router.get('/', RecurringBillsController.list);
router.post('/', validateRequest(recurringBillSchema), RecurringBillsController.create);
router.patch('/:bill_id', validateRequest(recurringBillSchema), RecurringBillsController.update);
router.delete('/:bill_id', RecurringBillsController.delete);

export default router;
