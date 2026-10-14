import express from 'express';
import { getReport, searchStudents } from '../controllers/feeReport.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';
import { validateReportQuery, validateStudentSearchQuery } from '../validations/feeReport.validation.js';

const router = express.Router();

router.get(
  '/students',
  protect,
  requireModuleAccess('fee-management', 'reports'),
  validateStudentSearchQuery,
  searchStudents,
);

router.get(
  '/',
  protect,
  requireModuleAccess('fee-management', 'reports'),
  validateReportQuery,
  getReport,
);

export default router;