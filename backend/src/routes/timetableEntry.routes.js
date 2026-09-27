import express from 'express';
import {
  createTimetableEntry,
  getAllTimetableEntries,
  getTimetableEntryById,
  updateTimetableEntry,
  deleteTimetableEntry,
} from '../controllers/timetableEntry.controller.js';
import {
  validateCreateTimetableEntry,
  validateUpdateTimetableEntry,
  validateTimetableEntryId,
} from '../validations/timetableEntry.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllTimetableEntries,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  validateTimetableEntryId,
  getTimetableEntryById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateTimetableEntry,
  createTimetableEntry,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateTimetableEntryId,
  validateUpdateTimetableEntry,
  updateTimetableEntry,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateTimetableEntryId,
  deleteTimetableEntry,
);

export default router;