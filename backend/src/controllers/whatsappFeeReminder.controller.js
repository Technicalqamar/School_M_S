import { asyncHandler } from '../utils/asyncHandler.js';
import whatsappFeeReminderService from '../services/whatsapp/whatsappFeeReminder.service.js';

const listWhatsAppFeeReminderRecipients = asyncHandler(async (req, res) => {
  const data = await whatsappFeeReminderService.getRecipients(req.query);
  return res.status(200).json({
    success: true,
    message: 'WhatsApp fee reminder recipients fetched successfully.',
    data,
  });
});

const getWhatsAppFeeReminderPreview = asyncHandler(async (req, res) => {
  const data = await whatsappFeeReminderService.getStudentPreview(
    req.params.studentId,
    req.query,
  );
  return res.status(200).json({
    success: true,
    message: 'WhatsApp fee reminder preview fetched successfully.',
    data,
  });
});

const sendWhatsAppFeeReminders = asyncHandler(async (req, res) => {
  const data = await whatsappFeeReminderService.sendReminders(req.body);
  return res.status(200).json({
    success: true,
    message: 'WhatsApp fee reminders processed.',
    data: {
      ...data,
      // Provider acceptance is not proof of delivery. The UI shows this warning
      // too; keeping it in the response makes the contract explicit for any API
      // client.
      providerAcceptanceOnly: true,
    },
  });
});

export {
  listWhatsAppFeeReminderRecipients,
  getWhatsAppFeeReminderPreview,
  sendWhatsAppFeeReminders,
};

export default {
  listWhatsAppFeeReminderRecipients,
  getWhatsAppFeeReminderPreview,
  sendWhatsAppFeeReminders,
};
