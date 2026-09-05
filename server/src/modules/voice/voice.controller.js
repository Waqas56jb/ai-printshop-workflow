import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import * as voiceService from './voice.service.js';

export const command = asyncHandler(async (req, res) => {
  const result = await voiceService.runIntentPipeline({
    transcript: req.body.transcript,
    userId: req.user.id,
  });
  return sendOk(res, result, result.message);
});

export const history = asyncHandler(async (req, res) => {
  const result = await voiceService.listHistory(req.query);
  return sendOk(res, result, 'Voice history retrieved');
});

export const confirm = asyncHandler(async (req, res) => {
  const result = await voiceService.confirmCommand(req.params.id, req.user.id, req.body || {});
  return sendOk(res, result, result.message);
});

export const reject = asyncHandler(async (req, res) => {
  const result = await voiceService.rejectCommand(req.params.id);
  return sendOk(res, result, 'Voice command rejected');
});
