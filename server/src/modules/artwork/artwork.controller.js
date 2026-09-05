import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as artworkService from './artwork.service.js';

export const list = asyncHandler(async (req, res) => {
  const artworks = await artworkService.listArtworks(req.params.id);
  return sendOk(res, artworks, 'Artworks retrieved');
});

export const upload = asyncHandler(async (req, res) => {
  const artwork = await artworkService.uploadArtwork(req.params.id, req.file, req.user.id);
  return sendCreated(res, artwork, 'Artwork uploaded');
});

export const approve = asyncHandler(async (req, res) => {
  const artwork = await artworkService.approveArtwork(req.params.id);
  return sendOk(res, artwork, 'Artwork approved');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await artworkService.deleteArtwork(req.params.id, req.user);
  return sendOk(res, result, 'Artwork deleted');
});
