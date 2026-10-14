import express from 'express';
import {
  getTeachersWithAttendance,
  saveAttendance,
  qrScanTeacherAttendance,
  getAttendanceByDate,
  getAttendanceByTeacher,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  resetCheckIn,
} from '../controllers/teacherAttendance.controller.js';
import {
  validateSaveAttendance,
  validateGetAttendance,
  validateQrScan,
} from '../validations/teacherAttendance.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.post(
  '/qr-scan',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-mark'),
  validateQrScan,
  qrScanTeacherAttendance,
);

router.get(
  '/teachers',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-view'),
  getTeachersWithAttendance,
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
  '/by-date',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-view'),
  validateGetAttendance,
  getAttendanceByDate,
);

router.get(
  '/teacher/:teacherId',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-view'),
  getAttendanceByTeacher,
);

router.patch(
  '/check-in',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-mark'),
  resetCheckIn,
);

router.post(
  '/',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-mark'),
  validateSaveAttendance,
  saveAttendance,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('attendance-management', 'teacher-attendance-mark'),
  deleteAttendance,
);

export default router;