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
import { requireModuleAccess } from '../middlewares/permission.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const schoolSettingsUpload = createUploader('school-settings', ['.jpg', '.jpeg', '.png', '.webp'], 5 * 1024 * 1024);

router.get('/public', getPublicSchoolSettings);

router.get(
  '/',
  protect,
  requireModuleAccess('school-settings'),
  getSchoolSettings,
);

router.put(
  '/information',
  protect,
  requireModuleAccess('school-settings'),
  validateSchoolInformation,
  updateSchoolInformation,
);

router.put(
  '/academic',
  protect,
  requireModuleAccess('school-settings'),
  validateAcademicSettings,
  updateAcademicSettings,
);

router.put(
  '/branding',
  protect,
  requireModuleAccess('school-settings'),
  validateBrandingSettings,
  updateBrandingSettings,
);

router.put(
  '/preferences',
  protect,
  requireModuleAccess('school-settings'),
  validateSystemPreferences,
  updateSystemPreferences,
);

router.put(
  '/image/:field',
  protect,
  requireModuleAccess('school-settings'),
  schoolSettingsUpload.single('image'),
  updateSchoolImage,
);

router.delete(
  '/image/:field',
  protect,
  requireModuleAccess('school-settings'),
  removeSchoolImage,
);

export default router;
