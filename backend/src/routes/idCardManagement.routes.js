import express from 'express';
import {
  getStudentsWithCards,
  generateQRCodes,
  regenerateQRCode,
  markAsPrinted,
  updateCardDesign,
} from '../controllers/idCardManagement.controller.js';
import {
  validateGetStudents,
  validateGenerate,
  validateRegenerate,
  validateMarkPrinted,
  validateUpdateDesign,
} from '../validations/idCardManagement.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/students',
  protect,
  authorize('admin'),
  validateGetStudents,
  getStudentsWithCards,
);

router.post(
  '/generate',
  protect,
  authorize('admin'),
  validateGenerate,
  generateQRCodes,
);

router.post(
  '/regenerate/:studentId',
  protect,
  authorize('admin'),
  validateRegenerate,
  regenerateQRCode,
);

router.patch(
  '/mark-printed',
  protect,
  authorize('admin'),
  validateMarkPrinted,
  markAsPrinted,
);

router.put(
  '/:studentId/design',
  protect,
  authorize('admin'),
  validateUpdateDesign,
  updateCardDesign,
);

export default router;