import express from 'express';
import { getStudentDashboardData } from '../controllers/studentDashboard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import portalAccessService from '../services/portalAccess.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const router = express.Router();

// Normal students access the dashboard through their own authenticated
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
  getStudentDashboardData,
);

export default router;