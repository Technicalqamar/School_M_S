import express from 'express';
import {
  getMyExams,
  getMyExamSubjects,
  getMyClassStudents,
  getMyMarks,
  bulkSaveMarks,
} from '../controllers/teacherMarksEntry.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/exams',
  protect,
  authorize('teacher'),
  getMyExams,
);

router.get(
  '/exam-subjects',
  protect,
  authorize('teacher'),
  getMyExamSubjects,
);

router.get(
  '/students',
  protect,
  authorize('teacher'),
  getMyClassStudents,
);

router.get(
  '/marks',
  protect,
  authorize('teacher'),
  getMyMarks,
);

router.post(
  '/bulk',
  protect,
  authorize('teacher'),
  bulkSaveMarks,
);

export default router;
