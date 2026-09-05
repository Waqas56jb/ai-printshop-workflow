import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as authController from './auth.controller.js';

const router = Router();

const registerStaffBody = z
  .object({
    full_name: z.string().min(1),
    role: z.enum(['admin', 'staff', 'worker']),
    job_title: z.string().optional().nullable(),
    omi_uid: z.string().optional().nullable(),
    email: z.union([z.string().email(), z.literal('')]).optional(),
    password: z.string().min(8).optional(),
  })
  .refine((data) => data.role === 'worker' || (Boolean(data.email) && Boolean(data.password)), {
    message: 'Email and password are required for login roles',
  });

router.post(
  '/register-staff',
  authenticate,
  requireRole('admin'),
  validate({ body: registerStaffBody }),
  authController.registerStaff
);

router.get('/me', authenticate, authController.me);

router.patch(
  '/me',
  authenticate,
  validate({
    body: z.object({
      full_name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }),
  }),
  authController.updateMe
);

router.post(
  '/change-password',
  authenticate,
  validate({
    body: z.object({
      current_password: z.string().min(1),
      new_password: z.string().min(8),
    }),
  }),
  authController.changePassword
);

router.post('/sign-out-everywhere', authenticate, authController.signOutEverywhere);

export default router;
