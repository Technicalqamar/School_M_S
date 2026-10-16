import { asyncHandler } from '../utils/asyncHandler.js';
import feeReminderService from '../services/feeReminder.service.js';

const listFeeReminderRecipients = asyncHandler(async (req, res) => {
  const result = await feeReminderService.listFeeReminderRecipients(req.query);
  res.json({ success: true, data: result });
});

const sendFeeReminders = asyncHandler(async (req, res) => {
  const result = await feeReminderService.sendFeeReminders(req.body, req.user?._id);
  res.json({ success: true, message: 'Fee reminders processed', data: result });
});

const getStudentReminderContext = asyncHandler(async (req, res) => {
  const result = await feeReminderService.getStudentReminderContext(req.params.studentId);
  res.json({ success: true, data: result });
});

const sendStudentFeeReminder = asyncHandler(async (req, res) => {
  const result = await feeReminderService.sendStudentFeeReminder(req.params.studentId, req.body, req.user?._id);
  res.json({
    success: true,
    message: 'Fee reminder sent',
    data: {
      notification: result.notification,
      created: result.created,
      studentId: result.student.studentId,
      totalOutstanding: result.totalOutstanding,
    },
  });
});

export { listFeeReminderRecipients, getStudentReminderContext, sendFeeReminders, sendStudentFeeReminder };
export default { listFeeReminderRecipients, getStudentReminderContext, sendFeeReminders, sendStudentFeeReminder };
