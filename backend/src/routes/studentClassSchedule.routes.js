import express from 'express';
import { getMyClassSchedule } from '../controllers/studentClassSchedule.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import portalAccessService from '../services/portalAccess.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const router = express.Router();

// Students can only READ their own class's timetable. The student's class is
// always derived automatically from the authenticated session, and only GET
// is exposed — there is no create/edit/delete capability for students.
//
// Normal students access the class schedule through their own authenticated
// account. An Administrator-authorized portal access is also allowed, in which
// case the selected student is resolved from the portal access context
// (accessType + accessStudentId) embedded in the token.
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
  getMyClassSchedule,
);

export default router;