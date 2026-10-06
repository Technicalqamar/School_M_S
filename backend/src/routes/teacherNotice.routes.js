import express from 'express';
import {
  getTeacherNotices,
  getTeacherNoticeById,
  getTeacherUnreadCount,
  markTeacherNoticeRead,
  markAllTeacherNoticesRead,
} from '../controllers/teacherNotice.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Teachers can only READ the notices addressed to them. The acting teacher is
// derived entirely from the authenticated session by teacherSession.service.js
// (same guard as every other Teacher Panel route), and there is no
// create/edit/delete/publish/archive capability for teachers.
//
// The only writes available here are read-state writes (mark-as-read /
// mark-all-read), which touch nothing but the notice's own `readBy` list. A
// teacher's read state is scoped to their own resolved Teacher profile and
// cannot be aimed at another teacher.
const teacherOnly = [protect, authorize('teacher')];

// Literal sub-paths must be declared before the parameterised handlers,
// otherwise `/unread-count` would be matched as a notice id.
router.get('/unread-count', ...teacherOnly, getTeacherUnreadCount);
router.put('/read-all', ...teacherOnly, markAllTeacherNoticesRead);

router.get('/', ...teacherOnly, getTeacherNotices);
router.get('/:id', ...teacherOnly, getTeacherNoticeById);
router.put('/:id/read', ...teacherOnly, markTeacherNoticeRead);

export default router;