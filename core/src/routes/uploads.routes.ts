import { Router } from 'express';
import multer from 'multer';
import { UploadsController } from '../controllers/uploads.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimiter } from '../middlewares/rate-limit.middleware';

const router = Router({ mergeParams: true });

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum file size limit
    files: 1,
    fields: 3,
    fieldSize: 1024,
    parts: 5
  }
});

// Protect upload endpoint: require JWT authentication
// and rate-limit to maximum of 10 uploads per minute per IP
router.post(
  '/',
  authMiddleware,
  rateLimiter(10, 60 * 1000),
  upload.single('file'),
  UploadsController.uploadFile
);

router.delete(
  '/',
  authMiddleware,
  rateLimiter(20, 60 * 1000),
  UploadsController.deleteFile
);

export default router;
