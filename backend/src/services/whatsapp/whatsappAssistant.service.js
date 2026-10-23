import Student from '../../models/student.model.js';
import studentFeesService from '../studentFees.service.js';
import studentPortalAttendanceService from '../studentPortalAttendance.service.js';
import studentPortalExamService from '../studentPortalExam.service.js';
import whatsappClient from './whatsappClient.service.js';
import whatsappSettingsService from './whatsappSettings.service.js';
import { createGuardianService } from './whatsappGuardian.service.js';
import { createWhatsAppAssistant } from './whatsappAssistant.core.js';
import { createConversationStore } from './whatsappConversation.core.js';

// ---------------------------------------------------------------------------
// WhatsApp assistant service binding (Phase 3B).
//
// Binds the pure assistant to the existing fee, attendance and examination
// business logic. The portal services already resolve the student from an id
// and filter every query by that student, so the WhatsApp layer never
// duplicates fee/attendance/result calculations: it supplies a synthetic
// student identity built ONLY from the guardian-verified student record.
//
// Replies reuse the existing WhatsApp client and the Admin-configured token
// (environment fallback is handled inside the client). The token is never
// logged or exposed here.
// ---------------------------------------------------------------------------

/**
 * The minimal identity accepted by `studentSession.resolveStudent`. The id is
 * always a Mongo `_id` that came from the guardian match, never from a
 * message body.
 */
const buildPortalUser = (student) => ({
  role: 'student',
  referenceId: student.id,
  referenceModel: 'Student',
});

const createWhatsAppAssistantService = ({
  guardian = createGuardianService({ model: Student }),
  conversations = createConversationStore(),
  feeService = studentFeesService,
  attendanceService = studentPortalAttendanceService,
  examService = studentPortalExamService,
  client = whatsappClient,
  getToken = () => whatsappSettingsService.getStoredToken(),
  logger = console,
} = {}) => {
  const fetchFeeSummary = async (student) => {
    const overview = await feeService.getMyFeeOverview(buildPortalUser(student));
    return overview || null;
  };

  const fetchAttendanceSummary = async (student) => {
    const data = await attendanceService.getMyAttendance(buildPortalUser(student), {}, {});
    if (!data) return null;

    return {
      academicYear: data.academicYear || '',
      summary: data.summary || null,
    };
  };

  const fetchResultsSummary = async (student) => {
    const data = await examService.getMyResults(buildPortalUser(student), {}, {});
    if (!data) return null;

    return {
      academicYear: data.academicYear || '',
      results: (Array.isArray(data.results) ? data.results : []).map((result) => ({
        name: String(result?.exam?.name || ''),
        type: String(result?.exam?.type || ''),
        percentage: result?.percentage ?? null,
        grade: result?.grade || '',
        status: result?.status || 'Pending',
      })),
    };
  };

  const sendText = async (to, text) => {
    const token = await getToken();
    return client.sendTextMessage({ to, text, token });
  };

  return createWhatsAppAssistant({
    guardian,
    conversations,
    fetchFeeSummary,
    fetchAttendanceSummary,
    fetchResultsSummary,
    sendText,
    logger,
  });
};

const whatsappAssistantService = createWhatsAppAssistantService();

export { buildPortalUser, createWhatsAppAssistantService };
export default whatsappAssistantService;
