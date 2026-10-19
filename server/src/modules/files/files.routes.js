import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import { artworkUpload } from '../artwork/artwork.upload.js';
import * as filesController from './files.controller.js';

const router = Router();
const pathValue = z.string().max(80).optional().default('');
const itemParams = z.object({ id: z.string().min(3).max(80) });

router.use(authenticate, requireRole('admin', 'staff'));

router.get('/', validate({ query: z.object({ path: pathValue }) }), filesController.list);
// Same rules as job artwork: any design format, 50 MB each, blocked: programs/web pages.
router.post('/upload', artworkUpload.array('files', 50), filesController.upload);
router.post(
  '/folder',
  validate({ body: z.object({ path: pathValue, name: z.string().min(1).max(120) }) }),
  filesController.createFolder
);
router.patch(
  '/:id',
  validate({ params: itemParams, body: z.object({ name: z.string().min(1).max(200) }) }),
  filesController.rename
);
router.delete('/:id', validate({ params: itemParams }), filesController.remove);
router.get('/:id/download', validate({ params: itemParams }), filesController.download);

export default router;
