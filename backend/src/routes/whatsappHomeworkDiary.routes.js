import express from 'express';
import {
  getWhatsAppHomeworkDiaryImage,
  listWhatsAppHomeworkDiaryRecipients,
  sendWhatsAppHomeworkDiary,
  uploadWhatsAppHomeworkDiaryImage,
} from '../controllers/whatsappHomeworkDiary.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';
import { ApiError } from '../utils/apiError.js';
import { MAX_TEMP_IMAGE_BYTES } from '../services/whatsapp/whatsappTempImage.service.js';

const router = express.Router();

const homeworkImageUpload = createUploader(
  'whatsapp-homework-diary',
  ['.jpg', '.jpeg', '.png', '.webp'],
  MAX_TEMP_IMAGE_BYTES,
);

// Multer's own errors would otherwise surface as a generic 500. The admin gets
// a precise message for the only expected failure (a file that is too large).
const acceptHomeworkImage = (req, res, next) => {
  homeworkImageUpload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error?.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(
            413,
            `Image must be smaller than ${MAX_TEMP_IMAGE_BYTES / (1024 * 1024)} MB.`,
          ),
        );
      }
      return next(
        new ApiError(
          400,
          'The image upload was rejected. Select one JPG, PNG, or WebP image.',
        ),
      );
    }

    return next(error);
  });
};

// Public temporary image fetch. Declared without `protect` because the WhatsApp
// provider calls it directly; the id is a 256-bit random token and the image
// expires after a short TTL.
router.get('/image/:imageId', getWhatsAppHomeworkDiaryImage);

// Admin-only. Only active students with a dedicated whatsappNumber are eligible;
// fatherPhone/alternatePhone are never used for this feature.
router.get(
  '/recipients',
  protect,
  authorize('admin'),
  listWhatsAppHomeworkDiaryRecipients,
);

router.post(
  '/image',
  protect,
  authorize('admin'),
  acceptHomeworkImage,
  uploadWhatsAppHomeworkDiaryImage,
);

router.post(
  '/send',
  protect,
  authorize('admin'),
  sendWhatsAppHomeworkDiary,
);

export default router;
