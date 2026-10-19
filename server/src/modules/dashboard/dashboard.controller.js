import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import * as dashboardService from './dashboard.service.js';
import { getOverview } from './overview.service.js';

export const admin = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getAdminDashboard();
  return sendOk(res, data, 'Admin dashboard');
});

export const staff = asyncHandler(async (req, res) => {
  const data = await dashboardService.getStaffDashboard(req.user.id);
  return sendOk(res, data, 'Staff dashboard');
});

export const overview = asyncHandler(async (req, res) => {
  const tz = typeof req.query.tz === 'string' ? req.query.tz.slice(0, 64) : 'UTC';
  return sendOk(res, await getOverview({ tz }), 'Dashboard');
});
