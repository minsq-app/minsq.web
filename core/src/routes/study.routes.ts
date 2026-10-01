import { validateRequest } from '../middlewares/validate.middleware';
import { studySettingsSchema, studyTrackSchema, studyNoteSchema, studyPlanSchema, studySessionSchema } from '../schemas/secondary.schema';
import { Router } from 'express';
import { StudyController } from '../controllers/study.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all study routes
router.use(authMiddleware);

// Settings
router.get('/settings', StudyController.getSettings);
router.post('/settings', validateRequest(studySettingsSchema), StudyController.saveSettings);

// Tracks
router.get('/tracks', StudyController.getTracks);
router.post('/tracks', validateRequest(studyTrackSchema), StudyController.saveTrack);
router.delete('/tracks/:track_id', StudyController.deleteTrack);

// Notes
router.get('/notes', StudyController.getNotes);
router.post('/notes', validateRequest(studyNoteSchema), StudyController.saveNote);
router.delete('/notes/:note_id', StudyController.deleteNote);

// Plans
router.get('/plans/:track_id', StudyController.getPlan);
router.post('/plans', validateRequest(studyPlanSchema), StudyController.savePlan);

// Sessions (Histórico)
router.get('/sessions', StudyController.list);
router.post('/sessions', validateRequest(studySessionSchema), StudyController.create);

export default router;
