import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { optionalUser } from '../../middleware/auth.js';
import * as settingsService from '../settings/settings.service.js';
import { getBoardStats, listScreens, noteBoardFetch } from '../../sockets/boardScreens.js';
import * as boardService from './board.service.js';

export const getBoard = asyncHandler(async (req, res) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  const boardKey = await settingsService.getSetting('board_key', '');
  const boardPublic = settingsService.isBoardPublic(await settingsService.getSetting('board_public', true));
  const keyOk = Boolean(key && boardKey && key === boardKey);
  void req.query.preview;

  if (boardPublic || keyOk) {
    const board = await boardService.getBoardDisplay();
    noteBoardFetch();
    return sendOk(res, board, 'Board retrieved');
  }

  const profile = await optionalUser(req);
  if (!profile || !['admin', 'staff'].includes(profile.role)) {
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
  const key = await settingsService.getSetting('board_key', '');
  const boardPublic = settingsService.isBoardPublic(await settingsService.getSetting('board_public', true));
  return sendOk(res, { key: key || '', board_public: boardPublic }, 'Board key');
});
