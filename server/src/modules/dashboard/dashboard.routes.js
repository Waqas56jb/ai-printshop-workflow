import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

router.use(authenticate);

router.get('/admin', requireRole('admin'), dashboardController.admin);
router.get('/staff', requireRole('admin', 'staff'), dashboardController.staff);

export default router;
