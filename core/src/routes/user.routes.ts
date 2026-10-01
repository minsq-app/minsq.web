import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { updatePasswordSchema } from '../schemas/auth.schema';
import { publicProfileLimiter, followActionLimiter, apiLimiter, checkHandleLimiter, onboardingLimiter } from '../middlewares/rateLimit.middleware';

const router = Router({ mergeParams: true });

// Public routes
router.get('/check-handle', checkHandleLimiter, optionalAuthMiddleware, UserController.checkHandle);
router.get('/:id/public', publicProfileLimiter, optionalAuthMiddleware, UserController.getPublicProfile);

// Protected routes
router.get('/me', authMiddleware, UserController.me);
router.post('/me/onboarding', onboardingLimiter, UserController.completeOnboarding);
router.post('/me/heartbeat', apiLimiter, authMiddleware, UserController.heartbeat);
router.patch('/me', authMiddleware, UserController.updateMe);

router.post('/me/avatar', authMiddleware, UserController.uploadAvatar);
router.post('/me/disable', authMiddleware, UserController.disableMe);
router.delete('/me', authMiddleware, UserController.deleteMe);
router.get('/me/export', authMiddleware, UserController.exportData);
router.get('/me/follow-requests', authMiddleware, UserController.listFollowRequests);

// Sessões
router.get('/me/sessions', authMiddleware, UserController.getSessions);
router.delete('/me/sessions', authMiddleware, UserController.revokeAllSessions);
router.delete('/me/sessions/:sessionId', authMiddleware, UserController.revokeSession);

// Mecânica de seguir/seguidores
router.post('/:id/follow', authMiddleware, followActionLimiter, UserController.followUser);
router.delete('/:id/follow', authMiddleware, followActionLimiter, UserController.unfollowUser);
router.get('/:id/follow-status', authMiddleware, UserController.getFollowStatus);
router.get('/:id/followers', authMiddleware, publicProfileLimiter, UserController.listFollowers);
router.get('/:id/following', authMiddleware, publicProfileLimiter, UserController.listFollowing);
router.patch('/follow-requests/:followerId/accept', authMiddleware, followActionLimiter, UserController.acceptFollowRequest);
router.patch('/follow-requests/:followerId/reject', authMiddleware, followActionLimiter, UserController.rejectFollowRequest);

export default router;
