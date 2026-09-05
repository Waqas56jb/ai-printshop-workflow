import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import * as boardController from './board.controller.js';

const router = Router();

router.get('/screens', authenticate, requireRole('admin'), boardController.getScreens);
router.get('/stats', authenticate, requireRole('admin', 'staff'), boardController.getStats);
router.get('/key', authenticate, requireRole('admin', 'staff'), boardController.getKey);
router.get('/', rateLimit({ windowMs: 60_000, max: 120 }), boardController.getBoard);

export default router;
