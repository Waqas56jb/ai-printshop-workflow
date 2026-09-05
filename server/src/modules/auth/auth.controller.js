import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as authService from './auth.service.js';

export const registerStaff = asyncHandler(async (req, res) => {
  const profile = await authService.registerStaff(req.body);
  return sendCreated(res, profile, 'Staff user created');
});

export const me = asyncHandler(async (req, res) => {
  const profile = await authService.getMe(req.user.id);
  return sendOk(res, profile, 'Current user');
});

export const updateMe = asyncHandler(async (req, res) => {
  const profile = await authService.updateMe(req.user.id, req.body);
  return sendOk(res, profile, 'Profile updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  return sendOk(res, result, 'Password changed');
});

export const signOutEverywhere = asyncHandler(async (req, res) => {
  const result = await authService.signOutEverywhere(req.user.id);
  return sendOk(res, result, 'Signed out everywhere');
});
