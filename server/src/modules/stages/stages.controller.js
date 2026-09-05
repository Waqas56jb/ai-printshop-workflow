import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as stagesService from './stages.service.js';

export const list = asyncHandler(async (_req, res) => {
  const stages = await stagesService.listStages();
  return sendOk(res, stages, 'Stages retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const stage = await stagesService.createStage(req.body);
  return sendCreated(res, stage, 'Stage created');
});

export const update = asyncHandler(async (req, res) => {
  const stage = await stagesService.updateStage(req.params.id, req.body);
  return sendOk(res, stage, 'Stage updated');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await stagesService.deleteStage(req.params.id);
  return sendOk(res, result, 'Stage deleted');
});

export const reorder = asyncHandler(async (req, res) => {
  const stages = await stagesService.reorderStages(req.body.ids);
  return sendOk(res, stages, 'Stages reordered');
});
