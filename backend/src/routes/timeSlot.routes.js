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
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('timetable-management', 'time-slots'),
  getAllTimeSlots,
);

router.get(
  '/:id',
  protect,
  requireModuleAccess('timetable-management', 'time-slots'),
  validateTimeSlotId,
  getTimeSlotById,
);

router.post(
  '/',
  protect,
  requireModuleAccess('timetable-management', 'time-slots'),
  validateCreateTimeSlot,
  createTimeSlot,
);

router.put(
  '/:id',
  protect,
  requireModuleAccess('timetable-management', 'time-slots'),
  validateUpdateTimeSlot,
  updateTimeSlot,
);

router.delete(
  '/:id',
  protect,
  requireModuleAccess('timetable-management', 'time-slots'),
  validateTimeSlotId,
  deleteTimeSlot,
);

export default router;