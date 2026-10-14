import express from 'express';
import { createClass, getAllClasses, getClassDetails, updateClass, deleteClass } from '../controllers/class.controller.js';
import { getClassTeacherAssignments, assignTeacherSubject, removeTeacherSubject } from '../controllers/classTeacher.controller.js';
import { validateCreateClass, validateUpdateClass } from '../validations/class.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireActionAccess('class-management', 'class-view'),
  getAllClasses,
);

router.get(
  '/:id/teacher-assignments',
  protect,
  requireActionAccess('class-management', 'class-view'),
  getClassTeacherAssignments,
);

router.post(
  '/:id/teacher-assignments',
  protect,
  requireActionAccess('class-management', 'class-edit'),
  assignTeacherSubject,
);

router.delete(
  '/:id/teacher-assignments/:teacherId/:subjectId',
  protect,
  requireActionAccess('class-management', 'class-edit'),
  removeTeacherSubject,
);

router.get(
  '/:id/details',
  protect,
  requireActionAccess('class-management', 'class-view'),
  getClassDetails,
);

router.post(
  '/',
  protect,
  requireActionAccess('class-management', 'class-create'),
  validateCreateClass,
  createClass,
);

router.put(
  '/:id',
  protect,
  requireActionAccess('class-management', 'class-edit'),
  validateUpdateClass,
  updateClass,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('class-management', 'class-delete'),
  deleteClass,
);

export default router;