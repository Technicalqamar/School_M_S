import express from 'express';
import { createClass, getAllClasses, getClassDetails, updateClass, deleteClass } from '../controllers/class.controller.js';
import { getClassTeacherAssignments, assignTeacherSubject, removeTeacherSubject } from '../controllers/classTeacher.controller.js';
import { validateCreateClass, validateUpdateClass } from '../validations/class.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllClasses,
);

router.get(
  '/:id/teacher-assignments',
  protect,
  authorize('admin'),
  getClassTeacherAssignments,
);

router.post(
  '/:id/teacher-assignments',
  protect,
  authorize('admin'),
  assignTeacherSubject,
);

router.delete(
  '/:id/teacher-assignments/:teacherId/:subjectId',
  protect,
  authorize('admin'),
  removeTeacherSubject,
);

router.get(
  '/:id/details',
  protect,
  authorize('admin'),
  getClassDetails,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateClass,
  createClass,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateClass,
  updateClass,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteClass,
);

export default router;
