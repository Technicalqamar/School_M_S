const DEFAULT_FEE_REMINDER_TEMPLATE = `Dear {{studentName}}, your outstanding fees for {{className}} ({{feePeriod}}) total PKR {{outstanding}}. Please clear your dues at the earliest.`;

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
  return result.trim();
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
