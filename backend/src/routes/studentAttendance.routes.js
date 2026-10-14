import express from 'express';
import {
  saveAttendance,
  qrScanAttendance,
  getStudentsWithAttendance,
  getAttendanceByClass,
  getAttendanceByDate,
  getAttendanceByStudent,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  deleteBulkAttendance,
  resetCheckIn,
} from '../controllers/studentAttendance.controller.js';
import { validateSaveAttendance, validateGetAttendance, validateQrScan } from '../validations/studentAttendance.validation.js';
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

router.get(
  '/students',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-view'),
  getStudentsWithAttendance,
);

router.get(
  '/history',
  protect,
  requireActionAccess('attendance-management', 'attendance-history-view'),
  getAttendanceHistory,
);

router.get(
  '/reports',
  protect,
  requireActionAccess('attendance-management', 'attendance-history-view'),
  getAttendanceReports,
);

router.get(
  '/by-class',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-view'),
  validateGetAttendance,
  getAttendanceByClass,
);

router.get(
  '/by-date',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-view'),
  validateGetAttendance,
  getAttendanceByDate,
);

router.get(
  '/student/:studentId',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-view'),
  getAttendanceByStudent,
);

router.patch(
  '/check-in',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-mark'),
  resetCheckIn,
);

router.post(
  '/',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-mark'),
  validateSaveAttendance,
  saveAttendance,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-mark'),
  deleteAttendance,
);

router.delete(
  '/',
  protect,
  requireActionAccess('attendance-management', 'student-attendance-mark'),
  deleteBulkAttendance,
);

export default router;