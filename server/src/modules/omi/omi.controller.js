import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import * as omiService from './omi.service.js';

export const webhook = asyncHandler(async (req, res) => {
  await omiService.verifyOmiSecret(req);
  const uid = req.query.uid;
  if (!uid) {
    throw new ApiError(400, 'uid query parameter is required');
  }
  const result = await omiService.handleWebhook({ uid, payload: req.body });
  return res.status(200).json({ message: result.message });
});

export const setupStatus = asyncHandler(async (req, res) => {
  const status = await omiService.getSetupStatus(req);
  return sendOk(res, status, 'OMI setup status');
});

export const webhookUrl = asyncHandler(async (req, res) => {
  return sendOk(res, { url: await omiService.webhookUrl(req, { mask: false }) }, 'OMI webhook URL');
});

export const debug = asyncHandler(async (_req, res) => {
  return sendOk(res, omiService.listDebugEvents(), 'OMI debug feed');
});
