import Student from '../../models/student.model.js';
import { ApiError } from '../../utils/apiError.js';
import { classMembershipFilter } from '../communicationTargeting.service.js';
import { PAK_MOBILE_REGEX } from '../../utils/pakistaniPhone.js';
import whatsappClient from './whatsappClient.service.js';
import whatsappSettingsService from './whatsappSettings.service.js';
import {
  MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS,
  createWhatsAppHomeworkDiaryService,
} from './whatsappHomeworkDiary.core.js';

const normalizeClassNames = (classNames) => {
  if (!classNames) return [];
  const list = Array.isArray(classNames) ? classNames : String(classNames).split(',');
  const cleaned = [...new Set(list.map((c) => String(c).trim()).filter(Boolean))];
  return cleaned;
};

const resolveAcademicYear = async (academicYear) => {
  if (academicYear && /^\d{4}$/.test(String(academicYear).trim())) {
    return String(academicYear).trim();
  }
  const SchoolSettings = (await import('../../models/schoolSettings.model.js')).default;
  const settings = await SchoolSettings.getSettings().catch(() => null);
  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }
  return String(new Date().getFullYear());
};

const isValidDedicatedWhatsApp = (value) => {
  if (!value) return false;
  return PAK_MOBILE_REGEX.test(String(value).trim());
};

const getRecipients = async ({ classNames, className, academicYear } = {}) => {
  const requestedClasses = normalizeClassNames(classNames || className);
  if (requestedClasses.length === 0) {
    throw new ApiError(400, 'At least one class is required');
  }

  const year = await resolveAcademicYear(academicYear);
  const filters = requestedClasses.map((cn) => classMembershipFilter(cn, year));
  const query = { status: 'Active', $or: filters };

  const students = await Student.find(query)
    .select('studentId fullName class academicYear whatsappNumber status')
    .lean();

  const recipients = students
    .map((s) => {
      const whatsappNumber = s.whatsappNumber ? String(s.whatsappNumber).trim() : '';
      const eligible = s.status === 'Active' && isValidDedicatedWhatsApp(whatsappNumber);
      return {
        studentId: s.studentId,
        fullName: s.fullName,
        className: s.class,
        academicYear: s.academicYear || year,
        whatsappNumber: eligible ? whatsappNumber : '',
        eligible,
        reason: eligible ? 'ready' : 'missing_whatsapp',
      };
    })
    .sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return (a.fullName || a.studentId).localeCompare(b.fullName || b.studentId);
    });

  const eligibleCount = recipients.filter((r) => r.eligible).length;

  return {
    academicYear: year,
    classNames: requestedClasses,
    recipients,
    eligibleCount,
    maxRecipients: MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS,
  };
};

const homeworkDiarySendService = createWhatsAppHomeworkDiaryService({
  getRecipients,
  settingsService: whatsappSettingsService,
  client: whatsappClient,
});

const sendHomeworkDiary = (payload) => homeworkDiarySendService.sendHomeworkDiary(payload);

export { MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS };
export default { getRecipients, sendHomeworkDiary };
