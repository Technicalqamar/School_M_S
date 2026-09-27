import express from 'express';
import {
  createTimeSlot,
  getAllTimeSlots,
  getTimeSlotById,
  updateTimeSlot,
  deleteTimeSlot,
} from '../controllers/timeSlot.controller.js';
import { validateCreateTimeSlot, validateUpdateTimeSlot, validateTimeSlotId } from '../validations/timeSlot.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllTimeSlots,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  validateTimeSlotId,
  getTimeSlotById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateTimeSlot,
  createTimeSlot,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateTimeSlot,
  updateTimeSlot,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateTimeSlotId,
  deleteTimeSlot,
);

export default router;