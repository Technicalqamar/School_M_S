import multer from 'multer';
import path from 'path';
import { ApiError } from '../utils/apiError.js';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const DEFAULT_MAX_SIZE = 2 * 1024 * 1024;

export const createUploader = (
  subDir,
  allowedExtensions = ALLOWED_EXTENSIONS,
  maxSize = DEFAULT_MAX_SIZE,
) => {
  const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, `Only ${allowedExtensions.join(', ')} files are allowed`), false);
    }
  };

  return multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: maxSize } });
};
