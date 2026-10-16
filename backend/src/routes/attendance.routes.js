import express from 'express';
import { qrScanAttendance } from '../controllers/attendance.controller.js';
import { validateQrScan } from '../validations/studentAttendance.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireAnyActionAccess } from '../middlewares/permission.middleware.js';
import {
  ATTENDANCE_MODULE_KEY,
  resolveQrScanAction,
} from '../services/commonAttendance.service.js';

const router = express.Router();

// This shared "scan any" endpoint serves both student and teacher QR codes, so
// the exact permission depends on which card is scanned. The route admits an
// operator holding either QR attendance action (keeping the permission check
// ahead of body validation, like the sibling attendance routes) and the
// controller then enforces the specific action for the resolved card type —
// never gating a teacher scan behind the student permission.
router.post(
  '/qr-scan',
  protect,
  requireAnyActionAccess(ATTENDANCE_MODULE_KEY, [
    resolveQrScanAction('student'),
    resolveQrScanAction('teacher'),
  ]),
  validateQrScan,
  qrScanAttendance,
);

export default router;
