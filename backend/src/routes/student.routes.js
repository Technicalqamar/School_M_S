import express from 'express';
import { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent } from '../controllers/student.controller.js';
import { openPortal } from '../controllers/portalAccess.controller.js';
import { validateCreateStudent, validateUpdateStudent } from '../validations/student.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const studentUpload = createUploader('student-images');

router.post(
  '/:studentId/open-portal',
  protect,
  authorize('admin'),
  openPortal,
);

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllStudents,
);

router.get(
  '/:studentId',
  protect,
  authorize('admin'),
  getStudentById,
);

router.delete(
  '/:studentId',
  protect,
  authorize('admin'),
  deleteStudent,
);

router.put(
  '/:studentId',
  protect,
  authorize('admin'),
  studentUpload.single('studentImage'),
  validateUpdateStudent,
  updateStudent,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  studentUpload.single('studentImage'),
  validateCreateStudent,
  createStudent,
);

export default router;
