import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as voiceController from './voice.controller.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'staff'));

router.post(
  '/command',
  validate({ body: z.object({ transcript: z.string().min(1) }) }),
  voiceController.command
);

router.get(
  '/history',
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['executed', 'pending_confirmation', 'rejected', 'failed']).optional(),
      user: z.string().uuid().optional(),
    }),
  }),
  voiceController.history
);

router.patch(
  '/:id/confirm',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z
      .object({
        job_id: z.string().uuid().optional(),
        allow_skip: z.boolean().optional(),
      })
      .optional(),
  }),
  voiceController.confirm
);

router.patch(
  '/:id/reject',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  voiceController.reject
);

export default router;
