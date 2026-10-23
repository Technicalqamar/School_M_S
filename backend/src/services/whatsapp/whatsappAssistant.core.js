import {
  STAGE,
  MENU,
  MAIN_MENU_TEXT,
  CHILD_PROMPT_TEXT,
  INVALID_INPUT_TEXT,
  PRIVACY_SAFE_TEXT,
  NOT_AVAILABLE_TEXT,
  MAX_STUDENTS,
  MAX_MESSAGE_LENGTH,
  formatChildList,
  formatStudentLabel,
  parseMenuSelection,
  parseChildSelection,
} from './whatsappConversation.core.js';
import { normalizePakistaniPhone } from './whatsappGuardian.core.js';

// ---------------------------------------------------------------------------
// WhatsApp assistant (Phase 3B).
//
// This is the pure orchestration layer: it receives the verified sender and
// message text from the (already signature-checked) webhook, matches the
// sender against guardian phone fields, keeps a small per-sender conversation
// state, and asks an injected fetcher for the selected student's data.
//
// Identity rules:
//   * The sender number is the ONLY identity signal. Nothing typed inside the
//     message is ever treated as a student id, phone number or proof of
//     identity.
//   * Child menus and the main menu are interpreted by stage, so "1" while
//     choosing a child is never confused with "1. Fee details".
//   * The selected student is re-verified against the guardian's number before
//     every data lookup, so a stale/revoked relationship cannot leak data.
//
// Replies are sent only to the normalized sender. Provider and lookup failures
// are swallowed and logged as fixed, PII-free strings.
// ---------------------------------------------------------------------------

const GREETING = 'Welcome to the school WhatsApp service.';
const MAIN_MENU_HINT = 'Reply 4 for the main menu.';

const formatAmount = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `Rs ${amount.toLocaleString('en-US')}`;
};

const formatDate = (value) => {
  if (!value) return '';

  // Date-only strings are calendar dates, not instants: format their
  // components directly so the school-local date never shifts by a timezone.
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
};

const formatFeeReply = (student, summary) => {
  if (!summary) return `${NOT_AVAILABLE_TEXT}\n\n${MAIN_MENU_HINT}`;

  const lines = [`Fee details for ${formatStudentLabel(student)}`];

  const outstanding = formatAmount(summary.outstandingAmount);
  if (outstanding) lines.push(`Outstanding: ${outstanding}`);

  if (Number(summary.outstandingCount) > 0) {
    lines.push(`Pending fee items: ${Number(summary.outstandingCount)}`);
  }

  if (summary.currentMonth) {
    const current = formatAmount(summary.currentFeeAmount);
    const paid = formatAmount(summary.paidAmount);
    const parts = [`Current month (${summary.currentMonth}): ${current || 'not set'}`];
    if (paid) parts.push(`paid ${paid}`);
    if (summary.paymentStatus) parts.push(String(summary.paymentStatus));
    lines.push(parts.join(', '));
  }

  const dueDate = formatDate(summary.dueDate);
  if (dueDate) lines.push(`Due date: ${dueDate}`);

  if (lines.length === 1) lines.push('No fee information is available yet.');

  lines.push('', MAIN_MENU_HINT);
  return lines.join('\n');
};

const formatAttendanceReply = (student, data) => {
  if (!data) return `${NOT_AVAILABLE_TEXT}\n\n${MAIN_MENU_HINT}`;

  const summary = data.summary || {};
  const total = Number(summary.total);

  if (!Number.isFinite(total) || total <= 0) {
    return `No attendance records have been recorded yet for ${formatStudentLabel(student)}.\n\n${MAIN_MENU_HINT}`;
  }

  const lines = [`Attendance for ${formatStudentLabel(student)}`];
  if (data.academicYear) lines.push(`Academic year: ${data.academicYear}`);
  lines.push(
    `Present: ${Number(summary.present) || 0}`,
    `Absent: ${Number(summary.absent) || 0}`,
    `Late: ${Number(summary.late) || 0}`,
    `Leave: ${Number(summary.leave) || 0}`,
    `Total: ${total}`,
    '',
    MAIN_MENU_HINT,
  );
  return lines.join('\n');
};

const formatResultsReply = (student, data) => {
  if (!data) return `${NOT_AVAILABLE_TEXT}\n\n${MAIN_MENU_HINT}`;

  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) {
    return `No exam results have been published yet for ${formatStudentLabel(student)}.\n\n${MAIN_MENU_HINT}`;
  }

  const lines = [`Exam results for ${formatStudentLabel(student)}`];
  if (data.academicYear) lines.push(`Academic year: ${data.academicYear}`);

  // Keep the reply short: the most recent three results are enough here.
  for (const result of results.slice(-3)) {
    const name = String(result?.name || 'Exam').trim();
    const status = String(result?.status || 'Pending').trim();
    const rawPercentage = result?.percentage;
    const percentage =
      rawPercentage === null || rawPercentage === undefined || rawPercentage === ''
        ? null
        : Number(rawPercentage);

    if (percentage !== null && Number.isFinite(percentage)) {
      const grade = result?.grade ? `, Grade ${result.grade}` : '';
      lines.push(`${name}: ${percentage}%${grade} - ${status}`);
    } else {
      lines.push(`${name}: ${status}`);
    }
  }

  lines.push('', MAIN_MENU_HINT);
  return lines.join('\n');
};

const isUsableStudent = (student) =>
  Boolean(student) && typeof student.id === 'string' && student.id.length > 0;

/**
 * Build the assistant.
 *
 * @param {object} deps
 * @param {{ findMatches: (phone: string) => Promise<{ canonicalPhone: string, students: object[] }> }} deps.guardian
 * @param {{ get: Function, set: Function, remove: Function }} deps.conversations
 * @param {(student: object) => Promise<object|null>} [deps.fetchFeeSummary]
 * @param {(student: object) => Promise<object|null>} [deps.fetchAttendanceSummary]
 * @param {(student: object) => Promise<object|null>} [deps.fetchResultsSummary]
 * @param {(to: string, text: string) => Promise<unknown>} deps.sendText
 * @param {{ error?: Function }} [deps.logger]
 */
const createWhatsAppAssistant = ({
  guardian,
  conversations,
  fetchFeeSummary = null,
  fetchAttendanceSummary = null,
  fetchResultsSummary = null,
  sendText,
  logger = console,
} = {}) => {
  if (!guardian || typeof guardian.findMatches !== 'function') {
    throw new Error('WhatsApp assistant requires a guardian lookup dependency');
  }
  if (!conversations || typeof conversations.get !== 'function' || typeof conversations.set !== 'function') {
    throw new Error('WhatsApp assistant requires a conversation store');
  }
  if (typeof sendText !== 'function') {
    throw new Error('WhatsApp assistant requires a sendText dependency');
  }

  // The recipient is always the normalized sender, never a value taken from
  // the message body. Delivery failures are logged without the recipient or
  // any message/provider detail.
  const safeSend = async (to, text) => {
    try {
      await sendText(to, text);
      return true;
    } catch {
      logger?.error?.('WhatsApp reply delivery failed.');
      return false;
    }
  };

  // A missing module is treated exactly like a module that failed: the
  // guardian gets the fixed "not available yet" reply and no invented data.
  const safeFetch = async (fetcher, student) => {
    if (typeof fetcher !== 'function') return null;

    try {
      return await fetcher(student);
    } catch {
      logger?.error?.('WhatsApp data lookup failed for a verified guardian.');
      return null;
    }
  };

  const startConversation = async (canonicalSender) => {
    let matches;

    try {
      matches = await guardian.findMatches(canonicalSender);
    } catch {
      logger?.error?.('WhatsApp guardian lookup failed.');
      const replySent = await safeSend(canonicalSender, NOT_AVAILABLE_TEXT);
      return { action: 'guardian_lookup_failed', replySent };
    }

    const students = (Array.isArray(matches?.students) ? matches.students : [])
      .filter(isUsableStudent)
      .slice(0, MAX_STUDENTS);

    conversations.remove(canonicalSender);

    if (students.length === 0) {
      const replySent = await safeSend(canonicalSender, PRIVACY_SAFE_TEXT);
      return { action: 'no_match', replySent };
    }

    if (students.length === 1) {
      conversations.set(canonicalSender, {
        stage: STAGE.MAIN_MENU,
        students,
        selectedStudentId: students[0].id,
      });

      const replySent = await safeSend(
        canonicalSender,
        `${GREETING}\n\nStudent: ${formatStudentLabel(students[0])}\n\n${MAIN_MENU_TEXT}`,
      );
      return { action: 'matched_single', replySent };
    }

    conversations.set(canonicalSender, {
      stage: STAGE.CHILD_SELECTION,
      students,
      selectedStudentId: null,
    });

    const replySent = await safeSend(
      canonicalSender,
      `${CHILD_PROMPT_TEXT}\n\n${formatChildList(students)}`,
    );
    return { action: 'matched_multiple', replySent };
  };

  const handleChildSelection = async (canonicalSender, state, body) => {
    const students = (Array.isArray(state.students) ? state.students : [])
      .filter(isUsableStudent)
      .slice(0, MAX_STUDENTS);

    const selection = parseChildSelection(body, students.length);
    if (selection === null) {
      const replySent = await safeSend(
        canonicalSender,
        `${INVALID_INPUT_TEXT}\n\n${formatChildList(students)}`,
      );
      return { action: 'invalid_child_selection', replySent };
    }

    const student = students[selection - 1];
    if (!student) {
      const replySent = await safeSend(
        canonicalSender,
        `${INVALID_INPUT_TEXT}\n\n${formatChildList(students)}`,
      );
      return { action: 'invalid_child_selection', replySent };
    }

    // The selected id comes only from the stored, DB-verified match list.
    conversations.set(canonicalSender, {
      ...state,
      stage: STAGE.MAIN_MENU,
      students,
      selectedStudentId: student.id,
    });

    const replySent = await safeSend(
      canonicalSender,
      `Selected: ${formatStudentLabel(student)}\n\n${MAIN_MENU_TEXT}`,
    );
    return { action: 'child_selected', replySent };
  };

  /**
   * Re-verify that the sender's number still belongs to the selected student
   * before every lookup. A revoked/changed relationship clears the state and
   * receives the same privacy-safe reply as an unknown number.
   */
  const verifySelectedStudent = async (canonicalSender, selectedStudentId) => {
    let matches;

    try {
      matches = await guardian.findMatches(canonicalSender);
    } catch {
      logger?.error?.('WhatsApp guardian verification failed.');
      return { ok: false, reason: 'verification_failed', student: null };
    }

    const student = (Array.isArray(matches?.students) ? matches.students : []).find(
      (candidate) => isUsableStudent(candidate) && String(candidate.id) === String(selectedStudentId),
    );

    if (!student) return { ok: false, reason: 'unverified_student', student: null };

    return { ok: true, reason: 'verified', student };
  };

  const handleMenu = async (canonicalSender, state, body) => {
    const selection = parseMenuSelection(body);

    if (selection === null) {
      const replySent = await safeSend(
        canonicalSender,
        `${INVALID_INPUT_TEXT}\n\n${MAIN_MENU_TEXT}`,
      );
      return { action: 'invalid_menu_selection', replySent };
    }

    if (selection === MENU.MAIN_MENU) {
      const replySent = await safeSend(canonicalSender, MAIN_MENU_TEXT);
      return { action: 'main_menu', replySent };
    }

    if (!state.selectedStudentId) {
      conversations.remove(canonicalSender);
      const replySent = await safeSend(canonicalSender, PRIVACY_SAFE_TEXT);
      return { action: 'missing_selection', replySent };
    }

    const verified = await verifySelectedStudent(canonicalSender, state.selectedStudentId);

    if (!verified.ok) {
      if (verified.reason === 'verification_failed') {
        const replySent = await safeSend(canonicalSender, NOT_AVAILABLE_TEXT);
        return { action: 'verification_failed', replySent };
      }

      conversations.remove(canonicalSender);
      const replySent = await safeSend(canonicalSender, PRIVACY_SAFE_TEXT);
      return { action: 'unverified_student', replySent };
    }

    const student = verified.student;

    if (selection === MENU.FEES) {
      const summary = await safeFetch(fetchFeeSummary, student);
      const replySent = await safeSend(canonicalSender, formatFeeReply(student, summary));
      return { action: 'menu_fees', replySent };
    }

    if (selection === MENU.ATTENDANCE) {
      const data = await safeFetch(fetchAttendanceSummary, student);
      const replySent = await safeSend(canonicalSender, formatAttendanceReply(student, data));
      return { action: 'menu_attendance', replySent };
    }

    const data = await safeFetch(fetchResultsSummary, student);
    const replySent = await safeSend(canonicalSender, formatResultsReply(student, data));
    return { action: 'menu_results', replySent };
  };

  const handleIncomingMessage = async ({ sender, text } = {}) => {
    const canonicalSender = normalizePakistaniPhone(sender);

    if (!canonicalSender) {
      logger?.warn?.('WhatsApp message ignored: sender is not a valid Pakistani mobile number.');
      return { action: 'ignored', reason: 'invalid_sender', replySent: false };
    }

    const body = typeof text === 'string' ? text.trim() : '';
    if (!body) {
      return { action: 'ignored', reason: 'empty_message', replySent: false };
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      logger?.warn?.('WhatsApp message ignored: message exceeds the length limit.');
      return { action: 'ignored', reason: 'message_too_long', replySent: false };
    }

    const stored = conversations.get(canonicalSender);

    // Defence in depth: a state is only usable for the exact key it was
    // stored under, even if a store implementation ever returned the wrong
    // entry.
    if (stored && stored.sender && stored.sender !== canonicalSender) {
      conversations.remove(canonicalSender);
      return startConversation(canonicalSender);
    }

    if (!stored) return startConversation(canonicalSender);

    if (stored.stage === STAGE.CHILD_SELECTION) {
      return handleChildSelection(canonicalSender, stored, body);
    }

    if (stored.stage === STAGE.MAIN_MENU) {
      return handleMenu(canonicalSender, stored, body);
    }

    conversations.remove(canonicalSender);
    return startConversation(canonicalSender);
  };

  return { handleIncomingMessage };
};

export {
  GREETING,
  MAIN_MENU_HINT,
  formatAmount,
  formatDate,
  formatFeeReply,
  formatAttendanceReply,
  formatResultsReply,
  createWhatsAppAssistant,
};

export default createWhatsAppAssistant;
