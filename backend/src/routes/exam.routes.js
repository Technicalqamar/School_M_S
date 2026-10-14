import express from 'express';
import { createExam, getAllExams, getExamById, updateExam, deleteExam } from '../controllers/exam.controller.js';
import { validateCreateExam, validateUpdateExam } from '../validations/exam.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('exam-management', 'exam-setup'),
  getAllExams,
);

router.get(
  '/:id',
  protect,
  requireModuleAccess('exam-management', 'exam-setup'),
  getExamById,
);

router.delete(
  '/:id',
  protect,
  requireModuleAccess('exam-management', 'exam-setup'),
  deleteExam,
);

router.put(
  '/:id',
  protect,
  requireModuleAccess('exam-management', 'exam-setup'),
  validateUpdateExam,
  updateExam,
);

router.post(
  '/',
  protect,
  requireModuleAccess('exam-management', 'exam-setup'),
  validateCreateExam,
  createExam,
);

export default router;