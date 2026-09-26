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
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.post(
  '/qr-scan',
  protect,
  authorize('admin'),
  validateQrScan,
  qrScanTeacherAttendance,
);

router.get(
  '/teachers',
  protect,
  authorize('admin'),
  getTeachersWithAttendance,
);

router.get(
  '/history',
  protect,
  authorize('admin'),
  getAttendanceHistory,
);

router.get(
  '/reports',
  protect,
  authorize('admin'),
  getAttendanceReports,
);

router.get(
  '/by-date',
  protect,
  authorize('admin'),
  validateGetAttendance,
  getAttendanceByDate,
);

router.get(
  '/teacher/:teacherId',
  protect,
  authorize('admin'),
  getAttendanceByTeacher,
);

router.patch(
  '/check-in',
  protect,
  authorize('admin'),
  resetCheckIn,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateSaveAttendance,
  saveAttendance,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteAttendance,
);

export default router;
