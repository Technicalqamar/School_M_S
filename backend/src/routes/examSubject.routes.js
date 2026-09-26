import express from 'express';
import {
  createExamSubject,
  getAllExamSubjects,
  getExamSubjectById,
  updateExamSubject,
  deleteExamSubject,
} from '../controllers/examSubject.controller.js';
import { validateCreateExamSubject, validateUpdateExamSubject } from '../validations/examSubject.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getAllExamSubjects);

router.get('/:id', getExamSubjectById);

router.delete('/:id', deleteExamSubject);

router.put('/:id', validateUpdateExamSubject, updateExamSubject);

router.post('/', validateCreateExamSubject, createExamSubject);

export default router;