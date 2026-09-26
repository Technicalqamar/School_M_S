import express from 'express';
import {
  getSchoolSettings,
  getPublicSchoolSettings,
  updateSchoolInformation,
  updateAcademicSettings,
  updateBrandingSettings,
  updateSystemPreferences,
  updateSchoolImage,
  removeSchoolImage,
} from '../controllers/schoolSettings.controller.js';
import {
  validateSchoolInformation,
  validateAcademicSettings,
  validateBrandingSettings,
  validateSystemPreferences,
} from '../validations/schoolSettings.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const schoolSettingsUpload = createUploader('school-settings', ['.jpg', '.jpeg', '.png', '.webp'], 5 * 1024 * 1024);

router.get('/public', getPublicSchoolSettings);

router.get(
  '/',
  protect,
  authorize('admin'),
  getSchoolSettings,
);

router.put(
  '/information',
  protect,
  authorize('admin'),
  validateSchoolInformation,
  updateSchoolInformation,
);

router.put(
  '/academic',
  protect,
  authorize('admin'),
  validateAcademicSettings,
  updateAcademicSettings,
);

router.put(
  '/branding',
  protect,
  authorize('admin'),
  validateBrandingSettings,
  updateBrandingSettings,
);

router.put(
  '/preferences',
  protect,
  authorize('admin'),
  validateSystemPreferences,
  updateSystemPreferences,
);

router.put(
  '/image/:field',
  protect,
  authorize('admin'),
  schoolSettingsUpload.single('image'),
  updateSchoolImage,
);

router.delete(
  '/image/:field',
  protect,
  authorize('admin'),
  removeSchoolImage,
);

export default router;
