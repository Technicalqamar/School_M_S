// Pure helpers for the Admin-only WhatsApp fee-reminder page.
//
// These functions contain the selection/confirmation rules that are easy to get
// wrong (missing-number recipients must never be selectable, the send payload
// must never include an amount or destination, duplicates must not cause two
// sends). Keeping them free of React makes them directly testable under the
// project's existing `node --test` setup.

export const MAX_WHATSAPP_REMINDER_RECIPIENTS = 100;

export const WHATSAPP_REASON_META = {
  ready: { label: 'Eligible', tone: 'green' },
  inactive: { label: 'Inactive student', tone: 'gray' },
  missing_whatsapp: { label: 'Missing WhatsApp number', tone: 'amber' },
  no_dues: { label: 'No outstanding dues', tone: 'gray' },
};

export const isWhatsAppConnected = (status) => status?.status === 'connected';

// Two top-level tabs on the WhatsApp Reminder page: the working fee-reminder
// workflow and the not-yet-implemented Assignments tab. Kept here so the page
// component stays a thin renderer and the tab keys can be unit-tested.
export const WHATSAPP_TABS = [
  { key: 'fee-reminders', label: 'Fee Reminders' },
  { key: 'assignments', label: 'Assignments' },
];

// A short, human-readable summary of a markup containing placeholders, used when
// a flow has no real recipient data to preview from. Placeholders are replaced
// with a friendly label (or a readable fallback) and repeated blank lines are
// collapsed, so the admin sees an accurate shape instead of a blank panel.
export const summarizeWhatsAppMessage = (template) => {
  if (!template) return '';
  return String(template)
    .replace(/\{\{studentName\}\}/g, 'Student name')
    .replace(/\{\{studentId\}\}/g, 'Student ID')
    .replace(/\{\{className\}\}/g, 'Class')
    .replace(/\{\{outstanding\}\}/g, 'Outstanding amount')
    .replace(/\{\{feePeriod\}\}/g, 'Fee period')
    .replace(/\{\{schoolName\}\}/g, 'School name')
    .replace(/\{\{[^}]*\}\}/g, 'the school')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const formatWhatsAppNumber = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Not provided';

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('92')) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return raw;
};

export const getEligibleRecipients = (recipients = []) =>
  (Array.isArray(recipients) ? recipients : []).filter((recipient) => recipient?.eligible);

/**
 * Toggle one eligible student. An ineligible student is rejected, and the
 * project-wide recipient limit is enforced before a new ID is added.
 */
export const toggleRecipientSelection = (
  selectedIds,
  studentId,
  recipients = [],
  limit = MAX_WHATSAPP_REMINDER_RECIPIENTS,
) => {
  const current = Array.isArray(selectedIds) ? selectedIds : [];
  if (typeof studentId !== 'string' || !studentId.trim()) {
    return { ids: current, changed: false, limited: false, ineligible: true };
  }

  const id = studentId.trim();
  if (current.includes(id)) {
    return { ids: current.filter((selected) => selected !== id), changed: true, limited: false, ineligible: false };
  }

  const eligible = getEligibleRecipients(recipients);
  if (!eligible.some((recipient) => recipient.studentId === id)) {
    return { ids: current, changed: false, limited: false, ineligible: true };
  }
  if (current.length >= limit) {
    return { ids: current, changed: false, limited: true, ineligible: false };
  }

  return { ids: [...current, id], changed: true, limited: false, ineligible: false };
};

/**
 * Select every eligible recipient up to the server-supported send limit. The
 * caller can warn when `truncated` is true rather than silently dropping rows.
 */
export const selectAllEligible = (
  recipients = [],
  limit = MAX_WHATSAPP_REMINDER_RECIPIENTS,
) => {
  const eligibleIds = getEligibleRecipients(recipients).map((recipient) => recipient.studentId);
  return {
    ids: eligibleIds.slice(0, limit),
    totalEligible: eligibleIds.length,
    truncated: eligibleIds.length > limit,
  };
};

/**
 * Build the POST /send body. Only selected IDs, the academic year and the
 * approved template/template text are ever sent - no client balance and no
 * destination number.
 */
export const buildSendRequest = ({
  studentIds,
  academicYear,
  messageTemplate,
  templateId = 'default',
} = {}) => {
  const ids = [];
  const seen = new Set();
  for (const raw of Array.isArray(studentIds) ? studentIds : []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const id = raw.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  const request = { studentIds: ids };
  if (academicYear) request.academicYear = String(academicYear).trim();

  const text = typeof messageTemplate === 'string' ? messageTemplate.trim() : '';
  if (text) request.messageTemplate = text;
  else request.templateId = templateId || 'default';

  return request;
};

export const getRecipientListState = ({ loading, error, recipients = [] } = {}) => {
  if (loading) return 'loading';
  if (error) return 'error';
  if (!Array.isArray(recipients) || recipients.length === 0) return 'empty';
  if (!recipients.some((recipient) => recipient?.eligible)) return 'no-eligible';
  return 'ready';
};

export const getReviewState = ({
  isConnected,
  selectedCount = 0,
  messageTemplate = '',
  sending = false,
} = {}) => {
  if (sending) return { canReview: false, reason: 'A WhatsApp send is already in progress.' };
  if (!isConnected) {
    return { canReview: false, reason: 'Connect WhatsApp in Settings before sending reminders.' };
  }
  if (selectedCount <= 0) return { canReview: false, reason: 'Select at least one eligible student.' };
  if (!String(messageTemplate || '').trim()) {
    return { canReview: false, reason: 'Enter a reminder message before reviewing recipients.' };
  }
  return { canReview: true, reason: '' };
};
