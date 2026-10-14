import express from 'express';
import { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent } from '../controllers/student.controller.js';
import { openPortal } from '../controllers/portalAccess.controller.js';
import { validateCreateStudent, validateUpdateStudent } from '../validations/student.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const studentUpload = createUploader('student-images');

// Opening the student portal is an administrative act (it grants the student
// access to their account), so it stays Admin-only for both roles.
router.post(
  '/:studentId/open-portal',
  protect,
  authorize('admin'),
  openPortal,
);

router.get(
  '/',
  protect,
  requireActionAccess('student-management', 'student-view'),
  getAllStudents,
);

router.get(
  '/:studentId',
  protect,
  requireActionAccess('student-management', 'student-view'),
  getStudentById,
);

router.delete(
  '/:studentId',
  protect,
  requireActionAccess('student-management', 'student-delete'),
  deleteStudent,
);

router.put(
  '/:studentId',
  protect,
  requireActionAccess('student-management', 'student-edit'),
  studentUpload.single('studentImage'),
  validateUpdateStudent,
  updateStudent,
);

router.post(
  '/',
  protect,
  requireActionAccess('student-management', 'student-create'),
  studentUpload.single('studentImage'),
  validateCreateStudent,
  createStudent,
);

export default router;