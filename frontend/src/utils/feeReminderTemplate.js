// Pure fee-reminder message renderer, mirrored from the backend's authoritative
// `backend/src/utils/feeReminderTemplate.js`. The frontend uses it ONLY to show
// the admin a live preview of what each recipient will receive; the message that
// is actually stored/sent is always rendered again on the server from the real
// per-recipient balance, so a preview can never become the delivered message.

export const FEE_REMINDER_PLACEHOLDERS = [
  '{{studentName}}',
  '{{studentId}}',
  '{{className}}',
  '{{outstanding}}',
  '{{feePeriod}}',
  '{{schoolName}}',
];

export const DEFAULT_FEE_REMINDER_TEMPLATE =
  'Dear {{studentName}}, your outstanding fees for {{className}} ({{feePeriod}}) total PKR {{outstanding}}. Please clear your dues at the earliest.';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const renderFeeReminderMessage = (template, context = {}) => {
  if (!template) return '';
  const replacements = {
    '{{studentName}}': context.studentName || '',
    '{{studentId}}': context.studentId || '',
    '{{className}}': context.className || '',
    '{{outstanding}}':
      context.outstanding != null ? Number(context.outstanding).toLocaleString('en-US') : '',
    '{{feePeriod}}': context.feePeriod || '',
    // Mirrors the backend token exactly. It is intentionally NOT offered as an
    // insertable placeholder because this data set has no authoritative due
    // date; it is rendered empty on both sides so a preview can never diverge
    // from the message the server actually stores.
    '{{dueDate}}': context.dueDate || '',
    '{{schoolName}}': context.schoolName || '',
  };

  return Object.entries(replacements)
    .reduce(
      (acc, [token, value]) => acc.replace(new RegExp(escapeRegExp(token), 'g'), value == null ? '' : String(value)),
      String(template),
    )
    .trim();
};

export default { DEFAULT_FEE_REMINDER_TEMPLATE, renderFeeReminderMessage, FEE_REMINDER_PLACEHOLDERS };
