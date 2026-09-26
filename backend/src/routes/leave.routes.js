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

const router = express.Router();

// All leave management endpoints are admin-only, consistent with the existing
// attendance authorization conventions.
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
  authorize('admin'),
  getAllLeaves,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  validateLeaveId,
  getLeaveById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateLeave,
  createLeave,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateLeaveId,
  validateUpdateLeave,
  updateLeave,
);

router.patch(
  '/:id/approve',
  protect,
  authorize('admin'),
  validateLeaveId,
  approveLeave,
);

router.patch(
  '/:id/reject',
  protect,
  authorize('admin'),
  validateLeaveId,
  rejectLeave,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateLeaveId,
  deleteLeave,
);

export default router;