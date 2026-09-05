import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import * as settingsService from './settings.service.js';

export const list = asyncHandler(async (_req, res) => {
  const settings = await settingsService.getSettings();
  return sendOk(res, settings, 'Settings retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body);
  return sendOk(res, settings, 'Settings updated');
});

export const uploadLogo = asyncHandler(async (req, res) => {
  const result = await settingsService.uploadLogo(req.file);
  return sendOk(res, result, 'Logo uploaded');
});

export const regenerateBoardKey = asyncHandler(async (_req, res) => {
  const result = await settingsService.regenerateBoardKey();
  return sendOk(res, result, 'Board key regenerated');
});

export const regenerateOmiSecret = asyncHandler(async (_req, res) => {
  const result = await settingsService.regenerateOmiSecret();
  return sendOk(res, result, 'OMI webhook secret regenerated');
});

export const exportData = asyncHandler(async (_req, res) => {
  const zip = await settingsService.exportData();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="printshop-export.zip"');
  return res.send(zip);
});
