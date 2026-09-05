import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import * as omiController from './omi.controller.js';

const router = Router();

router.post('/webhook', omiController.webhook);
router.get('/setup-status', omiController.setupStatus);
router.get('/webhook-url', authenticate, requireRole('admin'), omiController.webhookUrl);
router.get('/debug', authenticate, requireRole('admin'), omiController.debug);

export default router;
