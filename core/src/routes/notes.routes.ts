import { validateRequest } from '../middlewares/validate.middleware';
import { noteSchema } from '../schemas/resources.schema';
import { Router } from 'express';
import { NotesController } from '../controllers/notes.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router({ mergeParams: true });

// Protect all notes endpoints with JWT verification
router.use(authMiddleware);

router.get('/', NotesController.list);
router.post('/', validateRequest(noteSchema), NotesController.upsert);
router.delete('/trash/empty', NotesController.emptyTrash); // Placed before /:id to avoid conflict
router.delete('/:id', NotesController.delete);
router.post('/:id/restore', NotesController.restore);
router.delete('/:id/purge', NotesController.purge);

export default router;
