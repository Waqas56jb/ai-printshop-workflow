import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import * as usersService from './users.service.js';

export const list = asyncHandler(async (_req, res) => {
  const users = await usersService.listUsers();
  return sendOk(res, users, 'Users retrieved');
});

export const stats = asyncHandler(async (_req, res) => {
  const data = await usersService.getUserStats();
  return sendOk(res, data, 'User stats retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  return sendOk(res, user, 'User updated');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await usersService.resetPassword(req.params.id, req.body?.password);
  return sendOk(res, result, 'Password reset');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await usersService.deleteUser(req.params.id);
  return sendOk(res, result, 'User deleted');
});
