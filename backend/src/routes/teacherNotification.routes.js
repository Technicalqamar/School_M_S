import express from 'express';
import {
  getTeacherNotifications,
  getTeacherUnreadCount,
  markTeacherNotificationRead,
  markAllTeacherNotificationsRead,
  deleteTeacherNotification,
  deleteSelectedTeacherNotifications,
} from '../controllers/teacherNotification.controller.js';
import { validateDeleteSelectedNotifications } from '../validations/notification.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Same contract as the other Teacher Panel endpoints
// (teacherClassSchedule.routes.js / studentHomework.routes.js): the teacher is
// derived automatically from the authenticated session and only reads are
// exposed - there is no create/edit capability for teachers, so the inbox is
// never chosen by the client.
const teacherOnly = [protect, authorize('teacher')];

// Literal sub-paths must be declared before the parameterised handlers.
router.get('/unread-count', ...teacherOnly, getTeacherUnreadCount);
router.put('/read-all', ...teacherOnly, markAllTeacherNotificationsRead);
router.post('/delete-selected', ...teacherOnly, validateDeleteSelectedNotifications, deleteSelectedTeacherNotifications);

router.get('/', ...teacherOnly, getTeacherNotifications);
router.put('/:id/read', ...teacherOnly, markTeacherNotificationRead);
// Bell "X". The engine resolves the id against this teacher's own inbox, so a
// notification addressed to somebody else simply does not match (404) and is
// left untouched.
router.delete('/:id', ...teacherOnly, deleteTeacherNotification);

export default router;
