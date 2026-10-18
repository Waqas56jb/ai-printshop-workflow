import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as filesController from './files.controller.js';

const router = Router();
const pathValue = z.string().max(80).optional().default('');
const itemParams = z.object({ id: z.string().min(3).max(80) });
const filesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

router.use(authenticate, requireRole('admin', 'staff'));

router.get('/', validate({ query: z.object({ path: pathValue }) }), filesController.list);
router.post('/upload', filesUpload.array('files', 20), filesController.upload);
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
