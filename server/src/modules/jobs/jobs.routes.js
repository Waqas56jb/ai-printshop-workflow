import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as jobsController from './jobs.controller.js';
import * as artworkController from '../artwork/artwork.controller.js';
import * as notesController from '../notes/notes.controller.js';
import { artworkUpload } from '../artwork/artwork.upload.js';
import {
  assignJobBody,
  createJobBody,
  jobIdParams,
  jobListQuery,
  moveStageBody,
  updateJobBody,
} from './jobs.validation.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'staff'));

router.get('/', validate({ query: jobListQuery }), jobsController.list);
router.post(
  '/parse',
  validate({ body: z.object({ text: z.string().min(1) }) }),
  jobsController.parse
);
router.delete(
  '/cleanup',
  requireRole('admin'),
  validate({
    query: z.object({
      older_than_days: z.coerce.number().int().positive().default(365),
    }),
  }),
  jobsController.cleanup
);
router.post('/', validate({ body: createJobBody }), jobsController.create);
router.get('/:id', validate({ params: jobIdParams }), jobsController.getById);
router.patch('/:id', validate({ params: jobIdParams, body: updateJobBody }), jobsController.update);
router.patch(
  '/:id/stage',
  validate({ params: jobIdParams, body: moveStageBody }),
  jobsController.moveStage
);
router.patch(
  '/:id/assign',
  validate({ params: jobIdParams, body: assignJobBody }),
  jobsController.assign
);
router.patch('/:id/complete', validate({ params: jobIdParams }), jobsController.complete);
router.delete('/:id', requireRole('admin'), validate({ params: jobIdParams }), jobsController.remove);

router.get('/:id/artworks', validate({ params: jobIdParams }), artworkController.list);
router.post(
  '/:id/artworks',
  validate({ params: jobIdParams }),
  artworkUpload.single('file'),
  artworkController.upload
);

router.get('/:id/notes', validate({ params: jobIdParams }), notesController.list);
router.post(
  '/:id/notes',
  validate({
    params: jobIdParams,
    body: z.object({ content: z.string().min(1) }),
  }),
  notesController.create
);

export default router;
