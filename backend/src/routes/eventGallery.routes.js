import express from 'express';
import {
  uploadGalleryImage,
  bulkUploadGalleryImages,
  updateGalleryImage,
  deleteGalleryImage,
  deleteGalleryImagesByEvent,
  getGalleryByEvent,
  getGalleryImageById,
} from '../controllers/eventGallery.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const galleryUpload = createUploader('event-gallery');

router.get(
  '/event/:eventId',
  protect,
  authorize('admin'),
  getGalleryByEvent,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  getGalleryImageById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  galleryUpload.single('image'),
  uploadGalleryImage,
);

router.post(
  '/bulk',
  protect,
  authorize('admin'),
  galleryUpload.array('images', 20),
  bulkUploadGalleryImages,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  updateGalleryImage,
);

router.delete(
  '/event/:eventId',
  protect,
  authorize('admin'),
  deleteGalleryImagesByEvent,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteGalleryImage,
);

export default router;
