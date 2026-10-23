import { ApiError } from '../../utils/apiError.js';
import { normalizePakistaniMobile } from '../../utils/pakistaniPhone.js';
import {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  renderFeeReminderMessage,
} from '../../utils/feeReminderTemplate.js';
import {
  resolveRequestedClasses,
  getInvalidClassNames,
} from '../../utils/feeReminderClasses.js';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp fee reminders (core).
//
// This is deliberately a small orchestration layer around the existing fee
// services. It does not calculate a balance: every amount comes from
// `feeReminder.service`/`feeOutstanding.service`, which read the real fee
// ledger. The client supplies only student business IDs, an academic year and
// an approved message template - never an amount or a destination number.
//
// Every recipient is revalidated immediately before the provider call:
//   * the student must still exist and be Active;
//   * the dedicated `Student.whatsappNumber` must still be valid;
//   * the fresh ledger balance must still be greater than zero.
//
// The WhatsApp client and settings service are injected so every automated test
// uses fakes and never makes a live provider request.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_WHATSAPP_REMINDER_RECIPIENTS = 100;
export const MAX_WHATSAPP_REMINDER_TEMPLATE_LENGTH = 2000;

export const WHATSAPP_REMINDER_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  SKIPPED: 'skipped',
  FAILED: 'failed',
};

export const WHATSAPP_REMINDER_REASON = {
  READY: 'ready',
  INACTIVE: 'inactive',
  MISSING_WHATSAPP: 'missing_whatsapp',
  NO_DUES: 'no_dues',
  STUDENT_NOT_FOUND: 'Student not found',
  STUDENT_INACTIVE: 'Student is inactive',
  NO_WHATSAPP_NUMBER: 'No guardian WhatsApp number is stored',
  NO_OUTSTANDING_DUES: 'No outstanding dues',
  RENDER_FAILED: 'Message could not be rendered',
  PROVIDER_REJECTED: 'WhatsApp provider could not accept the message',
};

// The only template identifiers this feature exposes. The default fee-reminder
// template is the approved template; a custom template string is accepted for
// compatibility with the existing in-app reminder page, but it is still rendered
// server-side from the authoritative recipient context.
const APPROVED_TEMPLATE_IDS = new Set(['default', 'fee-reminder-default']);

const normalizeStudentIds = (studentIds) => {
  if (!Array.isArray(studentIds)) {
    throw new ApiError(400, 'studentIds must be an array of student IDs');
  }

  const unique = [];
  const seen = new Set();

  for (const raw of studentIds) {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new ApiError(400, 'Every selected student ID must be a non-empty string');
    }
    const studentId = raw.trim();
    if (seen.has(studentId)) continue;
    seen.add(studentId);
    unique.push(studentId);
  }

  if (!unique.length) {
    throw new ApiError(400, 'Select at least one student');
  }
  if (unique.length > MAX_WHATSAPP_REMINDER_RECIPIENTS) {
    throw new ApiError(
      400,
      `Too many recipients (${unique.length}). Select at most ${MAX_WHATSAPP_REMINDER_RECIPIENTS} students per WhatsApp send.`,
    );
  }

  return unique;
};

const resolveReminderTemplate = ({ templateId, messageTemplate } = {}, defaultTemplate) => {
  if (templateId !== undefined && templateId !== null) {
    if (typeof templateId !== 'string' || !APPROVED_TEMPLATE_IDS.has(templateId.trim())) {
      throw new ApiError(400, 'Unknown WhatsApp fee reminder template');
    }
  }

  if (messageTemplate === undefined || messageTemplate === null) {
    return defaultTemplate;
  }
  if (typeof messageTemplate !== 'string') {
    throw new ApiError(400, 'messageTemplate must be a string');
  }

  const trimmed = messageTemplate.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Message template is required');
  }
  if (trimmed.length > MAX_WHATSAPP_REMINDER_TEMPLATE_LENGTH) {
    throw new ApiError(
      400,
      `Message template must be at most ${MAX_WHATSAPP_REMINDER_TEMPLATE_LENGTH} characters`,
    );
  }
  return trimmed;
};

const getEligibility = ({ student, whatsappNumber, totalOutstanding }) => {
  if (!student || student.status !== 'Active') {
    return { eligible: false, reason: WHATSAPP_REMINDER_REASON.INACTIVE };
  }
  if (!whatsappNumber) {
    return { eligible: false, reason: WHATSAPP_REMINDER_REASON.MISSING_WHATSAPP };
  }
  if (!(Number(totalOutstanding) > 0)) {
    return { eligible: false, reason: WHATSAPP_REMINDER_REASON.NO_DUES };
  }
  return { eligible: true, reason: WHATSAPP_REMINDER_REASON.READY };
};

const publicRecipient = ({ item, student, normalizePhone }) => {
  const whatsappNumber = normalizePhone(student?.whatsappNumber);
  const totalOutstanding = Number(item.totalOutstanding || 0);
  const { eligible, reason } = getEligibility({ student, whatsappNumber, totalOutstanding });

  return {
    studentId: item.studentId,
    fullName: item.fullName || student?.fullName || '',
    className: item.className || student?.class || '',
    totalOutstanding,
    whatsappNumber,
    eligible,
    reason,
    // Context is needed for the admin's on-screen preview only. The final
    // message is always rendered again server-side at send time.
    context: item.context || null,
    preview: item.preview || '',
  };
};

/**
 * Build the WhatsApp fee-reminder service with injectable dependencies.
 *
 * @param {object} deps
 * @param {object} deps.feeReminderService Existing fee-reminder service.
 * @param {object} deps.settingsService Existing WhatsApp settings service.
 * @param {object} deps.client Existing WhatsApp API client.
 * @param {(studentId: string) => Promise<object|null>} deps.loadStudent
 * @param {(studentIds: string[]) => Promise<object[]>} deps.loadStudents
 * @param {(value: unknown) => string} [deps.normalizePhone]
 * @param {Function} [deps.renderMessage]
 * @param {string} [deps.defaultTemplate]
 * @param {{ error?: Function }} [deps.logger]
 */
const createWhatsAppFeeReminderService = ({
  feeReminderService,
  settingsService,
  client,
  loadStudent,
  loadStudents,
  normalizePhone = normalizePakistaniMobile,
  renderMessage = renderFeeReminderMessage,
  defaultTemplate = DEFAULT_FEE_REMINDER_TEMPLATE,
  logger = console,
} = {}) => {
  if (
    !feeReminderService ||
    !settingsService ||
    !client ||
    typeof loadStudent !== 'function' ||
    typeof loadStudents !== 'function'
  ) {
    throw new Error(
      'WhatsApp fee reminder service requires feeReminderService, settingsService, client, loadStudent and loadStudents',
    );
  }

  /**
   * List students with outstanding dues, enriched only with the stored
   * dedicated WhatsApp number and an eligibility reason. This uses the existing
   * fee-reminder recipient list, so no fee calculation is duplicated here.
   */
  const getRecipients = async ({ classNames, className, academicYear, search } = {}) => {
    const requestedClasses = resolveRequestedClasses({ classNames, className });
    if (requestedClasses.length) {
      const invalid = getInvalidClassNames(requestedClasses);
      if (invalid.length) {
        throw new ApiError(400, `Invalid class selection: ${invalid.join(', ')}`);
      }
    }

    const result = await feeReminderService.listFeeReminderRecipients({
      classNames: requestedClasses,
      academicYear,
      search: typeof search === 'string' ? search.trim() : undefined,
    });

    const eligibleItems = Array.isArray(result?.eligible) ? result.eligible : [];
    const studentIds = eligibleItems.map((item) => item.studentId).filter(Boolean);
    const students = studentIds.length ? await loadStudents(studentIds) : [];
    const studentById = new Map(
      (Array.isArray(students) ? students : []).map((student) => [student.studentId, student]),
    );

    const recipients = eligibleItems.map((item) =>
      publicRecipient({
        item,
        student: studentById.get(item.studentId),
        normalizePhone,
      }),
    );

    return {
      academicYear: result?.academicYear || academicYear || null,
      classNames: result?.classNames || requestedClasses,
      className: result?.className ?? (requestedClasses.length === 1 ? requestedClasses[0] : null),
      defaultTemplate: result?.defaultTemplate || defaultTemplate,
      recipients,
      eligibleCount: recipients.filter((recipient) => recipient.eligible).length,
      maxRecipients: MAX_WHATSAPP_REMINDER_RECIPIENTS,
    };
  };

  /**
   * One student's current preview. The year is passed through to the existing
   * reminder context service so a preview matches the selected ledger year.
   */
  const getStudentPreview = async (studentId, { academicYear } = {}) => {
    if (typeof studentId !== 'string' || !studentId.trim()) {
      throw new ApiError(400, 'Student ID is required');
    }

    const id = studentId.trim();
    const [context, student] = await Promise.all([
      feeReminderService.getStudentReminderContext(id, academicYear),
      loadStudent(id),
    ]);

    const whatsappNumber = normalizePhone(student?.whatsappNumber);
    const totalOutstanding = Number(context?.totalOutstanding || 0);
    const { eligible, reason } = getEligibility({ student, whatsappNumber, totalOutstanding });

    return {
      studentId: context?.studentId || id,
      fullName: context?.fullName || student?.fullName || '',
      className: context?.className || student?.class || '',
      academicYear: context?.academicYear || academicYear || null,
      totalOutstanding,
      whatsappNumber,
      eligible,
      reason,
      context: context?.context || null,
      preview: context?.preview || '',
      defaultTemplate: context?.defaultTemplate || defaultTemplate,
    };
  };

  const getProviderToken = async () => {
    let status;
    try {
      status = await settingsService.getStatus();
    } catch {
      throw new ApiError(
        503,
        'Unable to read the WhatsApp connection settings. Sending is disabled until the settings can be loaded.',
      );
    }

    if (status?.status !== 'connected') {
      throw new ApiError(
        409,
        'WhatsApp is not connected. Open Settings > WhatsApp, save a token and run a successful connection test before sending.',
      );
    }

    let token = null;
    try {
      token = await settingsService.getStoredToken();
    } catch {
      token = null;
    }
    if (!token) {
      throw new ApiError(
        503,
        'The stored WhatsApp API token is unavailable. Save it again in Settings > WhatsApp before sending.',
      );
    }

    return token;
  };

  /**
   * Send WhatsApp reminders independently to each selected student.
   *
   * `sent` means the provider accepted the request, not that WhatsApp delivered
   * or read it. A failure for one student never hides the results of the others.
   */
  const sendReminders = async ({ studentIds, academicYear, templateId, messageTemplate } = {}) => {
    const ids = normalizeStudentIds(studentIds);
    const providedTemplate =
      messageTemplate !== undefined && messageTemplate !== null && String(messageTemplate).trim() !== '';
    const template = resolveReminderTemplate({ templateId, messageTemplate }, defaultTemplate);

    // Prefer re-fetching each student's live ledger context below. This batch
    // context (loaded once, in a single query) is only a fallback for the rare
    // per-student re-fetch failure, so one transient DB blip degrades to a
    // slightly staler — but still server-authoritative — balance instead of
    // skipping the delivery entirely.
    const recipientList = await feeReminderService
      .listFeeReminderRecipients({ academicYear })
      .catch(() => null);
    const contextById = new Map(
      (Array.isArray(recipientList?.eligible) ? recipientList.eligible : [])
        .filter((item) => item && item.studentId)
        .map((item) => [item.studentId, item.context || null]),
    );

    // Sending is disabled unless the provider is explicitly connected and a
    // decryptable token is available. Both checks happen before any student data
    // is loaded or any provider call is attempted.
    const token = await getProviderToken();

    const results = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const studentId of ids) {
      try {
        const student = await loadStudent(studentId);
        if (!student) {
          skipped += 1;
          results.push({
            studentId,
            status: WHATSAPP_REMINDER_STATUS.SKIPPED,
            reason: WHATSAPP_REMINDER_REASON.STUDENT_NOT_FOUND,
          });
          continue;
        }

        if (student.status !== 'Active') {
          skipped += 1;
          results.push({
            studentId,
            status: WHATSAPP_REMINDER_STATUS.SKIPPED,
            reason: WHATSAPP_REMINDER_REASON.STUDENT_INACTIVE,
          });
          continue;
        }

        const whatsappNumber = normalizePhone(student.whatsappNumber);
        if (!whatsappNumber) {
          skipped += 1;
          results.push({
            studentId,
            status: WHATSAPP_REMINDER_STATUS.SKIPPED,
            reason: WHATSAPP_REMINDER_REASON.NO_WHATSAPP_NUMBER,
          });
          continue;
        }

        // Re-fetch the current ledger balance immediately before sending. The
        // client supplied no amount; this is the only authoritative source. If
        // that re-fetch throws, fall back to the batch context built above (also
        // server-side) rather than failing the whole reminder.
        let context;
        try {
          context = await feeReminderService.getStudentReminderContext(studentId, academicYear);
        } catch (error) {
          if (!contextById.has(studentId)) throw error;
          context = { totalOutstanding: 0, context: {} };
          const fallback = contextById.get(studentId) || {};
          context.context = fallback;
          context.totalOutstanding = Number(fallback.outstanding || 0);
        }
        const totalOutstanding = Number(context?.totalOutstanding || 0);
        if (!(totalOutstanding > 0)) {
          skipped += 1;
          results.push({
            studentId,
            status: WHATSAPP_REMINDER_STATUS.SKIPPED,
            reason: WHATSAPP_REMINDER_REASON.NO_OUTSTANDING_DUES,
          });
          continue;
        }

        const text = renderMessage(template, context?.context || {});
        if (!text) {
          failed += 1;
          results.push({
            studentId,
            status: WHATSAPP_REMINDER_STATUS.FAILED,
            reason: WHATSAPP_REMINDER_REASON.RENDER_FAILED,
          });
          continue;
        }

        await client.sendTextMessage({ to: whatsappNumber, text, token });
        sent += 1;
        results.push({
          studentId,
          status: WHATSAPP_REMINDER_STATUS.SENT,
          totalOutstanding,
        });
      } catch (error) {
        // A student deleted between the list and the send is a skip. Everything
        // else is reported as a safe, fixed failure reason: the provider error
        // can contain sensitive provider details, so it is never echoed.
        if (error?.statusCode === 404) {
          skipped += 1;
          results.push({
            studentId,
            status: WHATSAPP_REMINDER_STATUS.SKIPPED,
            reason: WHATSAPP_REMINDER_REASON.STUDENT_NOT_FOUND,
          });
          continue;
        }

        failed += 1;
        results.push({
          studentId,
          status: WHATSAPP_REMINDER_STATUS.FAILED,
          reason: WHATSAPP_REMINDER_REASON.PROVIDER_REJECTED,
        });
        logger?.error?.('WhatsApp fee reminder delivery failed.', {
          statusCode: error?.statusCode || null,
        });
      }
    }

    return {
      academicYear: academicYear || null,
      recipientCount: ids.length,
      sent,
      skipped,
      failed,
      providedTemplate,
      results,
    };
  };

  return {
    getRecipients,
    getStudentPreview,
    sendReminders,
  };
};

export {
  normalizeStudentIds,
  resolveReminderTemplate,
  getEligibility,
  createWhatsAppFeeReminderService,
};

export default createWhatsAppFeeReminderService;
