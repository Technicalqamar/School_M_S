import { ApiError } from '../../utils/apiError.js';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Homework Diary (core).
//
// The admin selects an image and a class. The image is stored by the existing
// backend for a short time (see `whatsappTempImage.service.js`) and the provider
// receives its temporary public URL. This module only orchestrates the send:
//
//   * the destination is always the student's dedicated `whatsappNumber` from
//     the database, never a number supplied by the client;
//   * every selected student is looked up again in the eligible recipient list
//     immediately before the provider loop, so an inactive student, a removed
//     number or a student outside the selected class is skipped;
//   * the WhatsApp settings service and provider client are injected, so tests
//     use fakes and never make a live provider request.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS = 100;
export const MAX_HOMEWORK_DIARY_TITLE_LENGTH = 200;
export const MAX_HOMEWORK_DIARY_MESSAGE_LENGTH = 2000;
export const MAX_HOMEWORK_DIARY_IMAGE_URL_LENGTH = 2048;

export const HOMEWORK_DIARY_STATUS = {
  SENT: 'sent',
  SKIPPED: 'skipped',
  FAILED: 'failed',
};

export const HOMEWORK_DIARY_REASON = {
  NOT_ELIGIBLE: 'Student is not an eligible active student in the selected class and academic year',
  MISSING_WHATSAPP: 'No dedicated WhatsApp number is stored',
  PROVIDER_REJECTED: 'WhatsApp provider could not accept the message',
};

export const normalizeStudentIds = (studentIds) => {
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
  if (unique.length > MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS) {
    throw new ApiError(
      400,
      `Too many recipients (${unique.length}). Select at most ${MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS} students per WhatsApp send.`,
    );
  }

  return unique;
};

export const buildHomeworkDiaryCaption = ({ title, message } = {}) => {
  if (typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Homework title is required');
  }

  const cleanTitle = title.trim();
  if (cleanTitle.length > MAX_HOMEWORK_DIARY_TITLE_LENGTH) {
    throw new ApiError(
      400,
      `Homework title must be at most ${MAX_HOMEWORK_DIARY_TITLE_LENGTH} characters`,
    );
  }

  if (message !== undefined && message !== null && typeof message !== 'string') {
    throw new ApiError(400, 'message must be a string');
  }

  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (cleanMessage.length > MAX_HOMEWORK_DIARY_MESSAGE_LENGTH) {
    throw new ApiError(
      400,
      `Homework message must be at most ${MAX_HOMEWORK_DIARY_MESSAGE_LENGTH} characters`,
    );
  }

  return cleanMessage ? `${cleanTitle}\n\n${cleanMessage}` : cleanTitle;
};

export const validateHomeworkDiaryImageUrl = (imageUrl) => {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
    throw new ApiError(400, 'A temporary image URL is required');
  }

  const trimmed = imageUrl.trim();
  if (trimmed.length > MAX_HOMEWORK_DIARY_IMAGE_URL_LENGTH) {
    throw new ApiError(400, 'The temporary image URL is too long');
  }
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    throw new ApiError(400, 'The temporary image URL is invalid');
  }

  return trimmed;
};

/**
 * Build the homework diary send service with injectable dependencies.
 *
 * @param {object} deps
 * @param {(args: object) => Promise<object>} deps.getRecipients Existing
 *   eligibility service (active + selected class/year + dedicated number).
 * @param {object} deps.settingsService Existing WhatsApp settings service.
 * @param {object} deps.client Existing WhatsApp API client.
 * @param {{ error?: Function }} [deps.logger]
 */
export const createWhatsAppHomeworkDiaryService = ({
  getRecipients,
  settingsService,
  client,
  logger = console,
} = {}) => {
  if (
    typeof getRecipients !== 'function' ||
    !settingsService ||
    !client ||
    typeof client.sendTextMessage !== 'function'
  ) {
    throw new Error(
      'WhatsApp homework diary service requires getRecipients, settingsService and client',
    );
  }

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
   * Send one image + caption to every selected eligible student.
   *
   * `sent` means the provider accepted the request, not that WhatsApp delivered
   * or read it. A failure for one student never hides the results of the others.
   */
  const sendHomeworkDiary = async ({
    studentIds,
    classNames,
    className,
    academicYear,
    title,
    message,
    imageUrl,
    onBeforeSend,
  } = {}) => {
    const ids = normalizeStudentIds(studentIds);
    const caption = buildHomeworkDiaryCaption({ title, message });
    const publicImageUrl = validateHomeworkDiaryImageUrl(imageUrl);

    // Sending is disabled unless the provider is explicitly connected and a
    // decryptable token is available. Both checks happen before student data is
    // loaded or any provider call is attempted.
    const token = await getProviderToken();

    const recipientData = await getRecipients({ classNames, className, academicYear });
    const eligibleById = new Map(
      (Array.isArray(recipientData?.recipients) ? recipientData.recipients : [])
        .filter((recipient) => recipient && recipient.eligible && recipient.studentId)
        .map((recipient) => [recipient.studentId, recipient]),
    );

    const results = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const studentId of ids) {
      const recipient = eligibleById.get(studentId);

      if (!recipient) {
        skipped += 1;
        results.push({
          studentId,
          status: HOMEWORK_DIARY_STATUS.SKIPPED,
          reason: HOMEWORK_DIARY_REASON.NOT_ELIGIBLE,
        });
        continue;
      }

      if (!recipient.whatsappNumber) {
        skipped += 1;
        results.push({
          studentId,
          status: HOMEWORK_DIARY_STATUS.SKIPPED,
          reason: HOMEWORK_DIARY_REASON.MISSING_WHATSAPP,
        });
        continue;
      }

      try {
        if (typeof onBeforeSend === 'function') onBeforeSend();
        await client.sendTextMessage({
          to: recipient.whatsappNumber,
          image: publicImageUrl,
          text: caption,
          token,
        });
        sent += 1;
        results.push({
          studentId,
          status: HOMEWORK_DIARY_STATUS.SENT,
        });
      } catch (error) {
        // The provider error can contain sensitive provider details or the
        // message text, so it is never echoed to the caller or the client.
        failed += 1;
        results.push({
          studentId,
          status: HOMEWORK_DIARY_STATUS.FAILED,
          reason: HOMEWORK_DIARY_REASON.PROVIDER_REJECTED,
        });
        logger?.error?.('WhatsApp homework diary delivery failed.', {
          statusCode: error?.statusCode || null,
        });
      }
    }

    return {
      academicYear: recipientData?.academicYear || academicYear || null,
      classNames: Array.isArray(recipientData?.classNames)
        ? recipientData.classNames
        : Array.isArray(classNames)
          ? classNames
          : [],
      recipientCount: ids.length,
      eligibleCount: Number(recipientData?.eligibleCount ?? eligibleById.size),
      sent,
      skipped,
      failed,
      results,
    };
  };

  return { sendHomeworkDiary };
};

export default createWhatsAppHomeworkDiaryService;
