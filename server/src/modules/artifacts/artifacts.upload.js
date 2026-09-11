import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../../utils/ApiError.js';

const blocked = new Set(['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.js', '.sh', '.ps1']);

export const artifactUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 40 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (blocked.has(ext)) {
      return cb(new ApiError(400, 'That file type is not allowed'));
    }
    cb(null, true);
  },
});
