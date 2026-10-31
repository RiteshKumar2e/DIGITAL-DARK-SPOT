import { Router } from 'express';
import researchRoutes from './research.routes.js';
import { health } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', health);
router.use('/research', researchRoutes);

export default router;
