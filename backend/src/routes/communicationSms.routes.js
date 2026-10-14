import express from 'express';
import {
  createSmsMessage,
  getSmsMessages,
  getSmsMessageById,
  updateSmsMessageStatus,
  deleteSmsMessage,
} from '../controllers/communicationSms.controller.js';
import {
  validateCreateSms,
  validateUpdateSmsStatus,
  validateListSms,
  validateSmsId,
} from '../validations/communicationSms.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get('/', protect, requireActionAccess('communication', 'sms-view'), validateListSms, getSmsMessages);
router.post('/', protect, requireActionAccess('communication', 'sms-send'), validateCreateSms, createSmsMessage);
router.get('/:id', protect, requireActionAccess('communication', 'sms-view'), validateSmsId, getSmsMessageById);
router.put('/:id', protect, requireActionAccess('communication', 'sms-send'), validateUpdateSmsStatus, updateSmsMessageStatus);
router.delete('/:id', protect, requireActionAccess('communication', 'sms-send'), validateSmsId, deleteSmsMessage);

export default router;