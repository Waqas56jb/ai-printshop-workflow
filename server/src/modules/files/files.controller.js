import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as filesService from './files.service.js';

export const list = asyncHandler(async (req, res) => {
  return sendOk(res, await filesService.list(req.query.path), 'Files retrieved');
});

export const upload = asyncHandler(async (req, res) => {
  const items = await filesService.upload(req.query.path || req.body.path, req.files, req.user);
  return sendCreated(res, items, 'Files uploaded');
});

export const createFolder = asyncHandler(async (req, res) => {
  return sendCreated(res, await filesService.createFolder(req.body.path, req.body.name), 'Folder created');
});

export const rename = asyncHandler(async (req, res) => {
  return sendOk(res, await filesService.rename(req.params.id, req.body.name), 'Renamed');
});

export const remove = asyncHandler(async (req, res) => {
  return sendOk(res, await filesService.remove(req.params.id, req.user), 'Deleted');
});

export const download = asyncHandler(async (req, res) => {
  return sendOk(res, await filesService.downloadUrl(req.params.id), 'Download link');
});
