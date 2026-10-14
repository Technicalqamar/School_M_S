import express from 'express';
import {
  createLeave,
  getAllLeaves,
  getLeaveById,
  checkLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  deleteLeave,
} from '../controllers/leave.controller.js';
import {
  validateCreateLeave,
  validateUpdateLeave,
  validateLeaveId,
  validateCheckLeave,
} from '../validations/leave.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// Leave management is part of the Receptionist `attendance-management` module.
// Every operation is gated by its own action so viewing a request never grants
// creating, editing, deleting, approving or rejecting one:
//   GET  /           -> leave-view
//   GET  /:id        -> leave-view
//   POST /           -> leave-create
//   PUT  /:id        -> leave-edit
//   PATCH /:id/approve -> leave-approve
//   PATCH /:id/reject  -> leave-reject
//   DELETE /:id      -> leave-delete
//
// The `/check` helper stays Admin-only: it was never called by the portal or
// receptionist UIs (attendance marking consumes the leave service in-process)
// and it probes anyone's approved-leave state for a date.
router.get(
  '/check',
  protect,
  authorize('admin'),
  validateCheckLeave,
  checkLeave,
);

router.get(
  '/',
  protect,
  requireActionAccess('attendance-management', 'leave-view'),
  getAllLeaves,
);

router.get(
  '/:id',
  protect,
  requireActionAccess('attendance-management', 'leave-view'),
  validateLeaveId,
  getLeaveById,
);

router.post(
  '/',
  protect,
  requireActionAccess('attendance-management', 'leave-create'),
  validateCreateLeave,
  createLeave,
);

router.put(
  '/:id',
  protect,
  requireActionAccess('attendance-management', 'leave-edit'),
  validateLeaveId,
  validateUpdateLeave,
  updateLeave,
);

router.patch(
  '/:id/approve',
  protect,
  requireActionAccess('attendance-management', 'leave-approve'),
  validateLeaveId,
  approveLeave,
);

router.patch(
  '/:id/reject',
  protect,
  requireActionAccess('attendance-management', 'leave-reject'),
  validateLeaveId,
  rejectLeave,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('attendance-management', 'leave-delete'),
  validateLeaveId,
  deleteLeave,
);

export default router;