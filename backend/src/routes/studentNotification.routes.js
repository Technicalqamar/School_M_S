import express from 'express';
import {
  getStudentNotifications,
  getStudentUnreadCount,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  deleteStudentNotification,
  deleteSelectedStudentNotifications,
} from '../controllers/studentNotification.controller.js';
import { validateDeleteSelectedNotifications } from '../validations/notification.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import portalAccessService from '../services/portalAccess.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const router = express.Router();

// Same contract as the other Student Portal read endpoints
// (studentDashboard.routes.js / studentClassSchedule.routes.js): a student uses
// their own authenticated account, and an Administrator-authorized Portal Access
// session is accepted as well. Both cases resolve to the *selected* student's
// account on the server, so the inbox is never chosen by the client.
const allowStudentOrPortalAccess = asyncHandler(async (req, res, next) => {
  if (req.user?.role === 'student') {
    return next();
  }

  if (req.accessType === portalAccessService.ACCESS_TYPE) {
    return next();
  }

  throw new ApiError(403, `Role (${req.user?.role}) is not allowed to access this resource`);
});

// Literal sub-paths must be declared before the parameterised handlers.
router.get('/unread-count', protect, allowStudentOrPortalAccess, getStudentUnreadCount);
router.put('/read-all', protect, allowStudentOrPortalAccess, markAllStudentNotificationsRead);
router.post('/delete-selected', protect, allowStudentOrPortalAccess, validateDeleteSelectedNotifications, deleteSelectedStudentNotifications);

router.get('/', protect, allowStudentOrPortalAccess, getStudentNotifications);
router.put('/:id/read', protect, allowStudentOrPortalAccess, markStudentNotificationRead);
// Bell "X". The engine resolves the id against this student's own inbox, so a
// notification addressed to somebody else simply does not match (404) and is
// left untouched.
router.delete('/:id', protect, allowStudentOrPortalAccess, deleteStudentNotification);

// No create or update route exists for students - only the Bell's own delete of
// a notification that is already in the caller's inbox.
export default router;
