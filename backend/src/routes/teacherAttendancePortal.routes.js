import express from 'express';
import { getMyAttendance } from '../controllers/teacherAttendancePortal.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

// Teacher Portal — My Attendance (READ-ONLY).
//
// A teacher can always view their own attendance (check-in / check-out and
// working hours). The teacher is always derived from the authenticated
// session, and no selector can target another teacher.
const router = express.Router();

router.get(
  '/',
  protect,
  authorize('teacher'),
  getMyAttendance,
);

export default router;