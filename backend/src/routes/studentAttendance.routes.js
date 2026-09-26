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
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.post(
  '/qr-scan',
  protect,
  authorize('admin'),
  validateQrScan,
  qrScanAttendance,
);

router.get(
  '/students',
  protect,
  authorize('admin'),
  getStudentsWithAttendance,
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
  '/by-class',
  protect,
  authorize('admin'),
  validateGetAttendance,
  getAttendanceByClass,
);

router.get(
  '/by-date',
  protect,
  authorize('admin'),
  validateGetAttendance,
  getAttendanceByDate,
);

router.get(
  '/student/:studentId',
  protect,
  authorize('admin'),
  getAttendanceByStudent,
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

router.delete(
  '/',
  protect,
  authorize('admin'),
  deleteBulkAttendance,
);

export default router;
