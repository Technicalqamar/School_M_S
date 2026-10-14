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
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('timetable-management', 'create-timetable'),
  getAllTimetableEntries,
);

router.get(
  '/:id',
  protect,
  requireModuleAccess('timetable-management', 'create-timetable'),
  validateTimetableEntryId,
  getTimetableEntryById,
);

router.post(
  '/',
  protect,
  requireModuleAccess('timetable-management', 'create-timetable'),
  validateCreateTimetableEntry,
  createTimetableEntry,
);

router.put(
  '/:id',
  protect,
  requireModuleAccess('timetable-management', 'create-timetable'),
  validateTimetableEntryId,
  validateUpdateTimetableEntry,
  updateTimetableEntry,
);

router.delete(
  '/:id',
  protect,
  requireModuleAccess('timetable-management', 'create-timetable'),
  validateTimetableEntryId,
  deleteTimetableEntry,
);

export default router;