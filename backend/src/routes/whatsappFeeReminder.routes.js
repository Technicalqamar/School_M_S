import express from 'express';
import {
  listWhatsAppFeeReminderRecipients,
  getWhatsAppFeeReminderPreview,
  sendWhatsAppFeeReminders,
} from '../controllers/whatsappFeeReminder.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// WhatsApp fee reminders can contact a real guardian, so the whole section is
// Admin-only. A receptionist grant for fee management is deliberately not
// accepted here - there is no receptionist-grantable permission for this page.
router.get(
  '/recipients',
  protect,
  authorize('admin'),
  listWhatsAppFeeReminderRecipients,
);

router.get(
  '/students/:studentId/preview',
  protect,
  authorize('admin'),
  getWhatsAppFeeReminderPreview,
);

router.post(
  '/send',
  protect,
  authorize('admin'),
  sendWhatsAppFeeReminders,
);

export default router;
