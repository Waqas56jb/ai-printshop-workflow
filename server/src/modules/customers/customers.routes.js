import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as customersController from './customers.controller.js';

const router = Router();
const idParams = z.object({ id: z.string().uuid() });
const customerBody = z.object({
  name: z.string().min(1),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
const customerPatch = customerBody.partial();

router.use(authenticate, requireRole('admin', 'staff'));

router.get(
  '/',
  validate({
    query: z.object({
      search: z.string().optional(),
      filter: z.enum(['active', 'none']).optional(),
      sort: z.enum(['recent', 'name', 'jobs']).optional().default('recent'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  customersController.list
);

router.get('/stats', customersController.stats);
router.post('/', validate({ body: customerBody }), customersController.create);
router.get('/:id', validate({ params: idParams }), customersController.getById);
router.patch('/:id', validate({ params: idParams, body: customerPatch }), customersController.update);
router.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: idParams }),
  customersController.remove
);

export default router;
