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
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), validateListSms, getSmsMessages);
router.post('/', protect, authorize('admin'), validateCreateSms, createSmsMessage);
router.get('/:id', protect, authorize('admin'), validateSmsId, getSmsMessageById);
router.put('/:id', protect, authorize('admin'), validateUpdateSmsStatus, updateSmsMessageStatus);
router.delete('/:id', protect, authorize('admin'), validateSmsId, deleteSmsMessage);

export default router;