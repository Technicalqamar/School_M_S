import express from 'express';
import { getTimetableDesigner } from '../controllers/timetableDesigner.controller.js';
import { validateTimetableDesignerQuery } from '../validations/timetableDesigner.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// Designer/View: read-only query API that composes the real saved timetable
// entries into the Academic Year → Group → Time Slot → Class grid.
router.get(
  '/',
  protect,
  requireModuleAccess('timetable-management', 'designer'),
  validateTimetableDesignerQuery,
  getTimetableDesigner,
);

export default router;