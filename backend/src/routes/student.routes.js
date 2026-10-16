import express from 'express';
import { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent, sendStudentNotice, getStudentNoticeRecipient } from '../controllers/student.controller.js';
import { openPortal } from '../controllers/portalAccess.controller.js';
import { validateCreateStudent, validateUpdateStudent, validateSendStudentNotice } from '../validations/student.validation.js';
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

// Sends a single in-app notice/reminder addressed to this one student's portal
// inbox. Admin-only, matching the existing open-portal action: the notification
// engine's authorization model only lets an admin address another principal, and
// the recipient is resolved server-side from :studentId (never the request body).
router.get(
  '/:studentId/notice-recipient',
  protect,
  authorize('admin'),
  getStudentNoticeRecipient,
);

router.post(
  '/:studentId/notices',
  protect,
  authorize('admin'),
  validateSendStudentNotice,
  sendStudentNotice,
);

router.post(
  '/:studentId/notice',
  protect,
  authorize('admin'),
  validateSendStudentNotice,
  sendStudentNotice,
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