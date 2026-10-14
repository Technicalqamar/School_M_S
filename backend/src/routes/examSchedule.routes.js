import express from 'express';
import {
  createExamSchedule,
  getAllExamSchedules,
  getExamScheduleById,
  updateExamSchedule,
  deleteExamSchedule,
} from '../controllers/examSchedule.controller.js';
import { validateCreateExamSchedule, validateUpdateExamSchedule } from '../validations/examSchedule.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.use(protect, requireModuleAccess('exam-management', 'exam-schedule'));

router.get('/', getAllExamSchedules);

router.get('/:id', getExamScheduleById);

router.delete('/:id', deleteExamSchedule);

router.put('/:id', validateUpdateExamSchedule, updateExamSchedule);

router.post('/', validateCreateExamSchedule, createExamSchedule);

export default router;