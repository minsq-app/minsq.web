import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { feedbackSchema } from '../schemas/feedback.schema';
import rateLimit from 'express-rate-limit';

const router = Router({ mergeParams: true });

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Você enviou muitos feedbacks. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', authMiddleware, feedbackLimiter, validateRequest(feedbackSchema), FeedbackController.createFeedback);

export default router;
