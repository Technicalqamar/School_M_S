import express from 'express';
import { createExam, getAllExams, getExamById, updateExam, deleteExam } from '../controllers/exam.controller.js';
import { validateCreateExam, validateUpdateExam } from '../validations/exam.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllExams,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  getExamById,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteExam,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateExam,
  updateExam,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateExam,
  createExam,
);

export default router;