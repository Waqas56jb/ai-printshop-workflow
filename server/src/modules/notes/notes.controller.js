import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../../utils/ApiResponse.js';
import * as notesService from './notes.service.js';

export const list = asyncHandler(async (req, res) => {
  const notes = await notesService.listNotes(req.params.id);
  return sendOk(res, notes, 'Notes retrieved');
});

export const create = asyncHandler(async (req, res) => {
  const note = await notesService.createNote(req.params.id, req.body.content, req.user.id);
  return sendCreated(res, note, 'Note created');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await notesService.deleteNote(req.params.id, req.user);
  return sendOk(res, result, 'Note deleted');
});
