import express from 'express';
import { getMyClassSchedule } from '../controllers/teacherClassSchedule.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Teachers can only READ their own timetable. The teacher is always derived
// automatically from the authenticated session, and only GET is exposed —
// there is no create/edit/delete capability for teachers.
router.get(
  '/',
  protect,
  authorize('teacher'),
  getMyClassSchedule,
);

export default router;