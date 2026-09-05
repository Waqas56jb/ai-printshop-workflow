import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as jobsService from './jobs.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await jobsService.listJobs(req.query);
  return sendOk(res, result, 'Jobs retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const job = await jobsService.createJob(req.body, req.user.id);
  return sendCreated(res, job, 'Job created');
});

export const getById = asyncHandler(async (req, res) => {
  const job = await jobsService.getJob(req.params.id);
  return sendOk(res, job, 'Job retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const job = await jobsService.updateJob(req.params.id, req.body);
  return sendOk(res, job, 'Job updated');
});

export const moveStage = asyncHandler(async (req, res) => {
  const job = await jobsService.moveJobStage(
    req.params.id,
    req.body.stage_id,
    req.user.id,
    req.body.source
  );
  return sendOk(res, job, 'Job stage updated');
});

export const assign = asyncHandler(async (req, res) => {
  const job = await jobsService.assignJob(req.params.id, req.body.assigned_to);
  return sendOk(res, job, 'Job assigned');
});

export const complete = asyncHandler(async (req, res) => {
  const job = await jobsService.completeJob(req.params.id, req.user.id);
  return sendOk(res, job, 'Job completed');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await jobsService.deleteJob(req.params.id);
  return sendOk(res, result, 'Job deleted');
});

export const cleanup = asyncHandler(async (req, res) => {
  const result = await jobsService.cleanupCompletedJobs(req.query.older_than_days);
  return sendOk(res, result, 'Old jobs cleared');
});

export const parse = asyncHandler(async (req, res) => {
  const parsed = await jobsService.parseJobText(req.body.text);
  return sendOk(res, parsed, 'Job parsed');
});
