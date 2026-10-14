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
import { requireActionAccess } from '../middlewares/permission.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const galleryUpload = createUploader('event-gallery');

router.get(
  '/event/:eventId',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-view'),
  getGalleryByEvent,
);

router.get(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-view'),
  getGalleryImageById,
);

router.post(
  '/',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-create'),
  galleryUpload.single('image'),
  uploadGalleryImage,
);

router.post(
  '/bulk',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-create'),
  galleryUpload.array('images', 20),
  bulkUploadGalleryImages,
);

router.put(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-create'),
  updateGalleryImage,
);

router.delete(
  '/event/:eventId',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-create'),
  deleteGalleryImagesByEvent,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'event-gallery-create'),
  deleteGalleryImage,
);

export default router;
