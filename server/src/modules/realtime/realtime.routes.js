import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import * as realtimeController from './realtime.controller.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'staff'));

router.get('/config', realtimeController.config);
router.post(
  '/session',
  rateLimit({ windowMs: 60_000, max: 10, key: (req) => req.user?.id }),
  realtimeController.createSession
);
router.post(
  '/tool',
  validate({
    body: z.object({
      name: z.string().min(1),
      arguments: z.any().optional(),
      args: z.any().optional(),
    }),
  }),
  realtimeController.runTool
);

export default router;
