import express from 'express';
import {
  requestStudentLeave,
  getMyLeaveRequests,
} from '../controllers/studentLeaveRequest.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import portalAccessService from '../services/portalAccess.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const router = express.Router();

// Students only manage THEIR OWN leave requests, stored in the existing Leave
// Management `leaves` collection. The student is always derived from the
// authenticated session, there is no update/delete capability, and every new
// request starts as Pending for the Admin to approve/reject through the
// existing Admin "Attendance → Leave" module.
//
// Normal students use their own authenticated account. An Administrator-
// authorized portal access is also allowed, in which case the selected student
// is resolved from the portal access context (accessType + accessStudentId)
// embedded in the token.
const allowStudentOrPortalAccess = asyncHandler(async (req, res, next) => {
  if (req.user?.role === 'student') {
    return next();
  }

  if (req.accessType === portalAccessService.ACCESS_TYPE) {
    return next();
  }

  throw new ApiError(403, `Role (${req.user?.role}) is not allowed to access this resource`);
});

router.get(
  '/',
  protect,
  allowStudentOrPortalAccess,
  getMyLeaveRequests,
);

router.post(
  '/',
  protect,
  allowStudentOrPortalAccess,
  requestStudentLeave,
);

export default router;