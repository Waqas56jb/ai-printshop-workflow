import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../../utils/ApiError.js';

const allowedMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/postscript',
  'application/illustrator',
  'application/octet-stream',
]);

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.ai']);

export const artworkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowedMimes.has(file.mimetype) || allowedExt.has(ext)) {
      return cb(null, true);
    }
    cb(new ApiError(400, 'Unsupported file type. Use images, PDF, AI, or SVG.'));
  },
});
