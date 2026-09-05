import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import * as dashboardService from './dashboard.service.js';

export const admin = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getAdminDashboard();
  return sendOk(res, data, 'Admin dashboard');
});

export const staff = asyncHandler(async (req, res) => {
  const data = await dashboardService.getStaffDashboard(req.user.id);
  return sendOk(res, data, 'Staff dashboard');
});
