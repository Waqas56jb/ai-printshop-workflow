import express, { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import * as omiController from './omi.controller.js';

const router = Router();

router.post('/webhook', omiController.webhook);
router.post('/audio', express.raw({ type: () => true, limit: '10mb' }), omiController.audio);
router.post('/board-relay', omiController.boardRelay);
router.get('/setup-status', omiController.setupStatus);
router.get('/webhook-url', authenticate, requireRole('admin'), omiController.webhookUrl);
router.get('/debug', authenticate, requireRole('admin'), omiController.debug);
router.get('/live-debug', omiController.liveDebug);

export default router;
