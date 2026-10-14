import express from 'express';
import { createTeacher, getAllTeachers, getTeacherById, updateTeacher, deleteTeacher } from '../controllers/teacher.controller.js';
import { validateCreateTeacher, validateUpdateTeacher } from '../validations/teacher.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const teacherUpload = createUploader('teachers-images');

router.get(
  '/',
  protect,
  requireActionAccess('teacher-management', 'teacher-view'),
  getAllTeachers,
);

router.get(
  '/:teacherId',
  protect,
  requireActionAccess('teacher-management', 'teacher-view'),
  getTeacherById,
);

router.delete(
  '/:teacherId',
  protect,
  requireActionAccess('teacher-management', 'teacher-delete'),
  deleteTeacher,
);

router.put(
  '/:teacherId',
  protect,
  requireActionAccess('teacher-management', 'teacher-edit'),
  teacherUpload.single('teacherImage'),
  validateUpdateTeacher,
  updateTeacher,
);

router.post(
  '/',
  protect,
  requireActionAccess('teacher-management', 'teacher-create'),
  teacherUpload.single('teacherImage'),
  validateCreateTeacher,
  createTeacher,
);

export default router;