import express from 'express';
import { getReport, searchStudents } from '../controllers/feeReport.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { validateReportQuery, validateStudentSearchQuery } from '../validations/feeReport.validation.js';

const router = express.Router();

router.get(
  '/students',
  protect,
  authorize('admin'),
  validateStudentSearchQuery,
  searchStudents,
);

router.get(
  '/',
  protect,
  authorize('admin'),
  validateReportQuery,
  getReport,
);

export default router;