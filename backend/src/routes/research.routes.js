import express, { Router } from 'express';
import { config } from '../config/index.js';
import * as research from '../controllers/research.controller.js';
import { analyzeLimiter, createSessionLimiter, searchLimiter, sourceLimiter } from '../middleware/rateLimits.js';

const router = Router();

router.post('/', createSessionLimiter, research.createSession);
router.post('/demo', createSessionLimiter, research.createDemoSession);
router.get('/:id', research.getSessionHandler);
router.patch('/:id', research.updateSession);
router.delete('/:id', research.deleteSessionHandler);

router.post('/:id/sources', sourceLimiter, research.addSource);
router.post(
  '/:id/sources/pdf',
  sourceLimiter,
  express.raw({ type: 'application/pdf', limit: config.limits.maxPdfBytes }),
  research.uploadPdf,
);
router.post('/:id/search', searchLimiter, research.search);
router.get('/:id/report', research.exportReport);
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
