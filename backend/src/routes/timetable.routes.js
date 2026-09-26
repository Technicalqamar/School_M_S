import express from 'express';
import {
  createTimetable,
  getAllTimetables,
  getTimetableByClass,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  getClassSubjects,
  getSubjectTeachers,
} from '../controllers/timetable.controller.js';
import { validateCreateTimetable, validateUpdateTimetable } from '../validations/timetable.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllTimetables,
);

router.get(
  '/class/:classId/subjects',
  protect,
  authorize('admin'),
  getClassSubjects,
);

router.get(
  '/class/:classId',
  protect,
  authorize('admin'),
  getTimetableByClass,
);

router.get(
  '/subject/:subjectId/teachers',
  protect,
  authorize('admin'),
  getSubjectTeachers,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  getTimetableById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateTimetable,
  createTimetable,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateTimetable,
  updateTimetable,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteTimetable,
);

export default router;
