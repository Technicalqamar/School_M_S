import express from 'express';
import { qrScanAttendance } from '../controllers/attendance.controller.js';
import { validateQrScan } from '../validations/studentAttendance.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.post('/qr-scan', protect, authorize('admin'), validateQrScan, qrScanAttendance);

export default router;
