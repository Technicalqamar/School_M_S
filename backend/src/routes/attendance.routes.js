import express from 'express';
import { qrScanAttendance } from '../controllers/attendance.controller.js';
import { validateQrScan } from '../validations/studentAttendance.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.post(
  '/qr-scan',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-mark'),
  validateQrScan,
  qrScanAttendance,
);

export default router;
