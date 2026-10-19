import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../../utils/ApiError.js';

// Print shops get every kind of design file (AI, PSD, EPS, CDR, TIFF, PDF, ZIP…),
// so any format is accepted except files a browser or computer could run.
// 50 MB per file is the storage limit of the Supabase project.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const blockedExt = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.sh', '.jar',
  '.js', '.mjs', '.html', '.htm', '.xhtml', '.php', '.dll',
]);
const blockedMimes = new Set(['text/html', 'application/x-msdownload', 'application/javascript', 'text/javascript']);

export function isArtworkFile(file) {
  const ext = path.extname(file?.originalname || '').toLowerCase();
  return !blockedExt.has(ext) && !blockedMimes.has(file?.mimetype);
}

function fileFilter(_req, file, cb) {
  if (isArtworkFile(file)) return cb(null, true);
  cb(new ApiError(400, `${file.originalname}: this kind of file can't be uploaded (programs and web pages are blocked)`));
}

export const artworkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter,
});
