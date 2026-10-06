import express from 'express';
import {
  getResponsibleClass,
  getClassStudents,
  saveStudentAttendance,
} from '../controllers/teacherStudentAttendance.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

// Teacher Portal — Manual Student Attendance.
//
// Permission-gated by the School Settings "Teacher Manual Student Attendance"
// flag (default OFF). The responsible class is ALWAYS derived from the logged-in
// teacher's timetable (first scheduled period) — the frontend can never select a
// class, and classId/teacherId selectors are denied.
const router = express.Router();

router.get(
  '/class',
  protect,
  authorize('teacher'),
  getResponsibleClass,
);

router.get(
  '/students',
  protect,
  authorize('teacher'),
  getClassStudents,
);

router.post(
  '/',
  protect,
  authorize('teacher'),
  saveStudentAttendance,
);

export default router;