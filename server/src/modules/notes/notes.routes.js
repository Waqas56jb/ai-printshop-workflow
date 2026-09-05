import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as notesController from './notes.controller.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'staff'));

router.delete(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  notesController.remove
);

export default router;
