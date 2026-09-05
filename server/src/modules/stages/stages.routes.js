import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as stagesController from './stages.controller.js';

const router = Router();
const idParams = z.object({ id: z.string().uuid() });
const stageBody = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  is_default: z.boolean().optional(),
  is_final: z.boolean().optional(),
  aliases: z.array(z.string()).optional(),
  show_on_board: z.boolean().optional(),
});

router.use(authenticate);

router.get('/', stagesController.list);

router.post('/', requireRole('admin'), validate({ body: stageBody }), stagesController.create);

router.patch(
  '/reorder',
  requireRole('admin'),
  validate({ body: z.object({ ids: z.array(z.string().uuid()).min(1) }) }),
  stagesController.reorder
);

router.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: idParams, body: stageBody.partial() }),
  stagesController.update
);

router.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: idParams }),
  stagesController.remove
);

export default router;
