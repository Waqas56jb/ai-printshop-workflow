import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as settingsController from './settings.controller.js';

const router = Router();
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(authenticate, requireRole('admin'));

router.get('/', settingsController.list);
router.get('/export', settingsController.exportData);
router.post('/logo', logoUpload.single('file'), settingsController.uploadLogo);
router.post('/regenerate-board-key', settingsController.regenerateBoardKey);
router.post('/regenerate-omi-secret', settingsController.regenerateOmiSecret);
router.patch(
  '/',
  validate({
    body: z
      .object({
        voice_auto_execute: z.boolean().optional(),
        voice_trigger_word: z.string().optional(),
        voice_confidence_threshold: z.number().min(0).max(1).optional(),
        voice_reply_on_device: z.boolean().optional(),
        voice_language: z.string().optional(),
        voice_allow_skip: z.boolean().optional(),
        board_refresh_seconds: z.number().int().positive().optional(),
        board_public: z.boolean().optional(),
        business_name: z.string().optional(),
        business_logo_url: z.string().nullable().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        currency: z.string().optional(),
        working_hours: z.any().optional(),
        board_theme: z.string().optional(),
        board_card_size: z.string().optional(),
        board_show_customer: z.boolean().optional(),
        board_show_due: z.boolean().optional(),
        board_overdue_highlight: z.boolean().optional(),
        board_hide_delivered_after: z.number().int().optional(),
        job_number_prefix: z.string().optional(),
        default_due_days: z.number().int().optional(),
        default_priority: z.string().optional(),
        product_types: z.array(z.string()).optional(),
        print_types: z.array(z.string()).optional(),
        require_artwork_before_printing: z.boolean().optional(),
        notify_overdue_email: z.boolean().optional(),
        notify_pending_voice: z.boolean().optional(),
        notify_daily_summary: z.boolean().optional(),
        notify_email: z.string().optional(),
      })
      .passthrough(),
  }),
  settingsController.update
);

export default router;
