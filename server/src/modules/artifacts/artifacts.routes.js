import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { artifactUpload } from './artifacts.upload.js';
import * as artifactsController from './artifacts.controller.js';

const idParams = z.object({ id: z.string().uuid() });
const tokenParams = z.object({ token: z.string().min(8).max(80) });

const router = Router();

router.get(
  '/share/clients/:token',
  rateLimit({ windowMs: 60_000, max: 60 }),
  validate({ params: tokenParams }),
  artifactsController.sharePack
);

router.get(
  '/customers/:id/artifacts',
  authenticate,
  requireRole('admin', 'staff'),
  validate({ params: idParams }),
  artifactsController.list
);

router.post(
  '/customers/:id/artifacts',
  authenticate,
  requireRole('admin', 'staff'),
  validate({ params: idParams }),
  artifactUpload.array('files', 40),
  artifactsController.upload
);

router.patch(
  '/artifacts/:id',
  authenticate,
  requireRole('admin', 'staff'),
  validate({
    params: idParams,
    body: z.object({
      sku: z.string().nullable().optional(),
      folder_path: z.string().nullable().optional(),
      network_path: z.string().nullable().optional(),
      revision: z.coerce.number().int().positive().optional(),
      proof_status: z.enum(['revision', 'proof', 'approved', 'print_ready']).optional(),
    }),
  }),
  artifactsController.update
);

router.delete(
  '/artifacts/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idParams }),
  artifactsController.remove
);

router.post(
  '/customers/:id/share-link',
  authenticate,
  requireRole('admin', 'staff'),
  validate({ params: idParams }),
  artifactsController.shareLink
);

export default router;
