import { Router } from 'express';
import * as research from '../controllers/research.controller.js';
import { analyzeLimiter, createSessionLimiter, sourceLimiter } from '../middleware/rateLimits.js';

const router = Router();

router.post('/', createSessionLimiter, research.createSession);
router.post('/demo', createSessionLimiter, research.createDemoSession);
router.get('/:id', research.getSessionHandler);
router.patch('/:id', research.updateSession);
router.delete('/:id', research.deleteSessionHandler);

router.post('/:id/sources', sourceLimiter, research.addSource);
router.get('/:id/sources/:sourceId', research.getSource);
router.post('/:id/sources/:sourceId/retry', sourceLimiter, research.retrySource);
router.delete('/:id/sources/:sourceId', research.removeSource);

router.post('/:id/analyze', analyzeLimiter, research.analyze);
router.get('/:id/findings', research.getFindings);

router.get('/:id/checklist', research.getChecklist);
router.post('/:id/checklist', research.addChecklistItem);
router.patch('/:id/checklist/:itemId', research.patchChecklistItem);
router.delete('/:id/checklist/:itemId', research.deleteChecklistItem);

export default router;
