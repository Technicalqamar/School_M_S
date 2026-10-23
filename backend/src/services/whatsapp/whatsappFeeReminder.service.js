import Student from '../../models/student.model.js';
import feeReminderService from '../feeReminder.service.js';
import whatsappClient from './whatsappClient.service.js';
import whatsappSettingsService from './whatsappSettings.service.js';
import { createWhatsAppFeeReminderService } from './whatsappFeeReminder.core.js';

// Only the fields needed for WhatsApp eligibility are selected. Guardian and
// unrelated student data is deliberately not loaded.
const STUDENT_LIST_FIELDS = 'studentId status whatsappNumber';
const STUDENT_FIELDS = 'studentId fullName class status whatsappNumber';

const loadStudent = (studentId) =>
  Student.findOne({ studentId }).select(STUDENT_FIELDS).lean();

const loadStudents = async (studentIds) => {
  if (!Array.isArray(studentIds) || !studentIds.length) return [];
  return Student.find({ studentId: { $in: studentIds } })
    .select(STUDENT_LIST_FIELDS)
    .lean();
};

const whatsappFeeReminderService = createWhatsAppFeeReminderService({
  feeReminderService,
  settingsService: whatsappSettingsService,
  client: whatsappClient,
  loadStudent,
  loadStudents,
});

export { createWhatsAppFeeReminderService };
export default whatsappFeeReminderService;
