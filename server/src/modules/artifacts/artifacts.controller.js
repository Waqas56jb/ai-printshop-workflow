import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as artifactsService from './artifacts.service.js';

export const list = asyncHandler(async (req, res) => {
  const items = await artifactsService.listArtifacts(req.params.id);
  return sendOk(res, items, 'Artifacts retrieved');
});

export const upload = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const items = await artifactsService.uploadArtifacts(req.params.id, files, req.user.id, {
    sku: req.body?.sku,
    skus: req.body?.skus,
    paths: req.body?.paths,
    network_folder: req.body?.network_folder,
    proof_status: req.body?.proof_status,
  });
  return sendCreated(res, items, items.length === 1 ? 'File uploaded' : `${items.length} files uploaded`);
});

export const update = asyncHandler(async (req, res) => {
  const item = await artifactsService.updateArtifact(req.params.id, req.body);
  return sendOk(res, item, 'Artifact updated');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await artifactsService.deleteArtifact(req.params.id);
  return sendOk(res, result, 'Artifact deleted');
});

export const shareLink = asyncHandler(async (req, res) => {
  const rotate = req.body?.rotate === true || req.query.rotate === '1';
  const token = rotate
    ? await artifactsService.rotateShareToken(req.params.id)
    : await artifactsService.ensureShareToken(req.params.id);
  return sendOk(res, { token, path: `/c/${token}` }, 'Share link ready');
});

export const sharePack = asyncHandler(async (req, res) => {
  const pack = await artifactsService.getSharePack(req.params.token);
  return sendOk(res, pack, 'Client pack retrieved');
});
