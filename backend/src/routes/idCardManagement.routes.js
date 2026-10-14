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
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// The ID Card tab lives under Attendance Management in the Admin sidebar, so the
// whole API sits in the `attendance-management` module (it previously sat under
// `student-management`; the move keeps one grant in one module).

router.get(
  '/students',
  protect,
  requireActionAccess('attendance-management', 'id-card-view'),
  validateGetStudents,
  getStudentsWithCards,
);

router.post(
  '/generate',
  protect,
  requireActionAccess('attendance-management', 'id-card-generate'),
  validateGenerate,
  generateQRCodes,
);

router.post(
  '/regenerate/:studentId',
  protect,
  requireActionAccess('attendance-management', 'id-card-generate'),
  validateRegenerate,
  regenerateQRCode,
);

router.patch(
  '/mark-printed',
  protect,
  requireActionAccess('attendance-management', 'id-card-generate'),
  validateMarkPrinted,
  markAsPrinted,
);

router.put(
  '/:studentId/design',
  protect,
  requireActionAccess('attendance-management', 'id-card-generate'),
  validateUpdateDesign,
  updateCardDesign,
);

export default router;