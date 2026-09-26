import express from 'express';
import { createTeacher, getAllTeachers, getTeacherById, updateTeacher, deleteTeacher } from '../controllers/teacher.controller.js';
import { validateCreateTeacher, validateUpdateTeacher } from '../validations/teacher.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const teacherUpload = createUploader('teachers-images');

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllTeachers,
);

router.get(
  '/:teacherId',
  protect,
  authorize('admin'),
  getTeacherById,
);

router.delete(
  '/:teacherId',
  protect,
  authorize('admin'),
  deleteTeacher,
);

router.put(
  '/:teacherId',
  protect,
  authorize('admin'),
  teacherUpload.single('teacherImage'),
  validateUpdateTeacher,
  updateTeacher,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  teacherUpload.single('teacherImage'),
  validateCreateTeacher,
  createTeacher,
);

export default router;
