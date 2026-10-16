import express from 'express';
import {
  listFeeReminderRecipients,
  getStudentReminderContext,
  sendFeeReminders,
  sendStudentFeeReminder,
} from '../controllers/feeReminder.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';
import { validateSendFeeReminders, validateSendStudentFeeReminder } from '../validations/feeReminder.validation.js';

const router = express.Router();

router.get(
  '/recipients',
  protect,
  requireModuleAccess('fee-management', 'reminders'),
  listFeeReminderRecipients,
);

router.post(
  '/send',
  protect,
  requireModuleAccess('fee-management', 'reminders'),
  validateSendFeeReminders,
  sendFeeReminders,
);

router.get(
  '/students/:studentId/recipient',
  protect,
  requireModuleAccess('fee-management', 'reminders'),
  getStudentReminderContext,
);

router.post(
  '/students/:studentId/send',
  protect,
  requireModuleAccess('fee-management', 'reminders'),
  validateSendStudentFeeReminder,
  sendStudentFeeReminder,
);

export default router;
