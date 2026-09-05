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
  const sessionId = req.query.session_id || req.body?.session_id || '';
  const result = await omiService.handleWebhook({ uid, sessionId, payload: req.body });
  return res.status(200).json(
    omiService.buildWebhookResponse({
      sessionId,
      message: result.message,
      replyOnDevice: result.replyOnDevice,
    })
  );
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
