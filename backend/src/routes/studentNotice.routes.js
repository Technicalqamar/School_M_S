import express from 'express';
import {
  getStudentNotices,
  getStudentNoticeById,
  getStudentUnreadCount,
  markStudentNoticeRead,
  markAllStudentNoticesRead,
} from '../controllers/studentNotice.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import portalAccessService from '../services/portalAccess.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const router = express.Router();

// Same contract as the other Student Portal read endpoints
// (studentDashboard.routes.js / studentClassSchedule.routes.js): a student uses
// their own authenticated account, and an Administrator-authorized Portal Access
// session is accepted as well. Both cases resolve to the *selected* student's
// account on the server, so the notice board is never chosen by the client.
const allowStudentOrPortalAccess = asyncHandler(async (req, res, next) => {
  if (req.user?.role === 'student') {
    return next();
  }

  if (req.accessType === portalAccessService.ACCESS_TYPE) {
    return next();
  }

  throw new ApiError(403, `Role (${req.user?.role}) is not allowed to access this resource`);
});

// Read-only surface: no create, edit, delete, publish or archive route exists
// for students. The Admin /api/v1/communication/notices endpoints keep sole
// ownership of the Draft → Published → Archived lifecycle.
//
// The only writes available here are read-state writes (mark-as-read /
// mark-all-read), which touch nothing but the notice's own `readBy` list. A
// student's read state is scoped to their own account and cannot be aimed at
// another student, because the receipt is derived from the session.
const studentOnly = [protect, allowStudentOrPortalAccess];

// Literal sub-paths must be declared before the parameterised handlers,
// otherwise `/unread-count` would be matched as a notice id.
router.get('/unread-count', ...studentOnly, getStudentUnreadCount);
router.put('/read-all', ...studentOnly, markAllStudentNoticesRead);

router.get('/', ...studentOnly, getStudentNotices);
router.get('/:id', ...studentOnly, getStudentNoticeById);
router.put('/:id/read', ...studentOnly, markStudentNoticeRead);

export default router;