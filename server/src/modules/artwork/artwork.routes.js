import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as artworkController from './artwork.controller.js';

const router = Router();
const idParams = z.object({ id: z.string().uuid() });

router.use(authenticate, requireRole('admin', 'staff'));

router.patch('/:id/approve', validate({ params: idParams }), artworkController.approve);
router.delete('/:id', validate({ params: idParams }), artworkController.remove);

export default router;
