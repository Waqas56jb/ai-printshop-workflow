import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as usersController from './users.controller.js';

const router = Router();
const idParams = z.object({ id: z.string().uuid() });

router.use(authenticate);

router.get('/', requireRole('admin', 'staff'), usersController.list);
router.get('/stats', requireRole('admin'), usersController.stats);

router.use(requireRole('admin'));

router.post(
  '/:id/reset-password',
  validate({
    params: idParams,
    body: z.object({ password: z.string().min(8).optional() }).default({}),
  }),
  usersController.resetPassword
);

router.patch(
  '/:id',
  validate({
    params: idParams,
    body: z.object({
      full_name: z.string().min(1).optional(),
      job_title: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      role: z.enum(['admin', 'staff', 'worker']).optional(),
      is_active: z.boolean().optional(),
      invite_status: z.enum(['active', 'invited', 'inactive']).optional(),
      omi_uid: z.string().nullable().optional(),
    }),
  }),
  usersController.update
);

router.delete('/:id', validate({ params: idParams }), usersController.remove);

export default router;
