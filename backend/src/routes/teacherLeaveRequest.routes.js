import express from 'express';
import {
  getMyLeaveRequests,
  requestLeave,
} from '../controllers/teacherLeaveRequest.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

// Teacher Portal — My Leave Requests (existing Leave system, teacher-derived).
//
// A teacher submits Pending leave requests (never self-approved) and views only
// their own requests. The teacher is always derived from the authenticated
// session; the Admin continues approving/rejecting through the existing Leave
// Management module.
const router = express.Router();

router.get(
  '/',
  protect,
  authorize('teacher'),
  getMyLeaveRequests,
);

router.post(
  '/',
  protect,
  authorize('teacher'),
  requestLeave,
);

export default router;