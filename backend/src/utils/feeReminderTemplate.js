// Authoritative fee-reminder message template and renderer.
//
// The message each guardian actually receives is ALWAYS rendered here on the
// server from the current fee-ledger data; the frontend mirror
// (`frontend/src/utils/feeReminderTemplate.js`) exists only to show the Admin a
// live preview, so the two files must keep the same default template and the
// same replacement rules.
//
// The default template deliberately only uses data this system really holds:
// student name, class, fee period (derived from the outstanding ledger entries),
// the authoritative outstanding amount and — when the school has saved one — the
// school name. There is no authoritative due date, payment link or portal URL in
// this data set, so the default never mentions any. `{{schoolName}}` sits on its
// own final line: the renderer trims the result, so an unconfigured school name
// simply leaves the message ending on "Thank you."
const DEFAULT_FEE_REMINDER_TEMPLATE = `Dear {{studentName}},

This is a gentle reminder from {{schoolName}} regarding the outstanding fee balance on your account.

Student: {{studentName}}
Class: {{className}}
Fee period: {{feePeriod}}
Outstanding amount: PKR {{outstanding}}

Kindly arrange to clear the outstanding dues at your earliest convenience. If you have already made the payment, please ignore this message and accept our thanks.

Thank you.`;

const renderFeeReminderMessage = (template, context = {}) => {
  if (!template) return '';
  let result = String(template);
  const replacements = {
    '{{studentName}}': context.studentName || '',
    '{{studentId}}': context.studentId || '',
    '{{className}}': context.className || '',
    '{{outstanding}}': context.outstanding != null ? Number(context.outstanding).toLocaleString('en-US') : '',
    '{{feePeriod}}': context.feePeriod || '',
    '{{dueDate}}': context.dueDate || '',
    '{{schoolName}}': context.schoolName || '',
  };

  Object.entries(replacements).forEach(([key, value]) => {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value == null ? '' : String(value));
  });

  // Drop lines that became empty once an unconfigured placeholder was replaced
  // (for example a school-name line), and collapse any leftover blank runs, so a
  // missing optional value never leaves an awkward gap. Fully-rendered lines and
  // intentional blank lines between populated text are preserved.
  return result
    .split('\n')
    .filter((line) => {
      if (!line.includes('{{')) return true; // no placeholder -> keep verbatim
      return line.replace(/\{\{[^}]*\}\}/g, '').trim().length > 0;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const buildFeePeriod = (dues = []) => {
  const labels = dues
    .map((d) => d.label || d.month || d.exam || '')
    .filter(Boolean);
  if (!labels.length) return 'current session';
  return Array.from(new Set(labels)).slice(0, 10).join(', ');
};

export {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  renderFeeReminderMessage,
  buildFeePeriod,
};
export default { DEFAULT_FEE_REMINDER_TEMPLATE, renderFeeReminderMessage, buildFeePeriod };
