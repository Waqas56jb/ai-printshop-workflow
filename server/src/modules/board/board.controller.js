import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { optionalUser } from '../../middleware/auth.js';
import * as settingsService from '../settings/settings.service.js';
import { getBoardStats, listScreens, noteBoardFetch } from '../../sockets/boardScreens.js';
import * as boardService from './board.service.js';

export const getBoard = asyncHandler(async (req, res) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  const preview = req.query.preview === '1' || req.query.preview === 'true';
  const raw = await settingsService.getRawSettings();
  const boardKey = typeof raw.board_key === 'string' ? raw.board_key : '';
  const boardPublic = settingsService.isBoardPublic(raw.board_public);
  const keyOk = Boolean(key && boardKey && key === boardKey);
  const profile = await optionalUser(req);
  const isStaff = Boolean(profile && ['admin', 'staff'].includes(profile.role));

  // Admin/staff UI (column counts) — lean array, not the heavy TV payload
  if (isStaff && !preview && !key) {
    const board = await boardService.getBoard();
    noteBoardFetch();
    return sendOk(res, board, 'Board retrieved');
  }

  if (boardPublic || keyOk) {
    const board = await boardService.getBoardDisplay();
    noteBoardFetch();
    return sendOk(res, board, 'Board retrieved');
  }

  if (!isStaff) {
    throw new ApiError(401, 'Board key required');
  }

  const board = await boardService.getBoard();
  noteBoardFetch();
  return sendOk(res, board, 'Board retrieved');
});

export const getScreens = asyncHandler(async (_req, res) => {
  return sendOk(res, listScreens(), 'Board screens');
});

export const getStats = asyncHandler(async (_req, res) => {
  return sendOk(res, getBoardStats(), 'Board stats');
});

export const getKey = asyncHandler(async (_req, res) => {
  const raw = await settingsService.getRawSettings();
  const key = typeof raw.board_key === 'string' ? raw.board_key : '';
  const boardPublic = settingsService.isBoardPublic(raw.board_public);
  return sendOk(res, { key: key || '', board_public: boardPublic }, 'Board key');
});
