import { ApiError } from '../utils/apiError.js';
import { resolveRequestedClasses } from '../utils/feeReminderClasses.js';

const validateSendFeeReminders = (req, res, next) => {
  const { className, classNames, messageTemplate, message } = req.body || {};
  // Accepts the multi-class `classNames` (array or comma string) as well as the
  // legacy single `className`; the service still re-resolves and validates the
  // exact class list against the real class catalog before anything is written.
  if (!resolveRequestedClasses({ classNames, className }).length) {
    throw new ApiError(400, 'At least one class is required');
  }
  if (!messageTemplate && !message) throw new ApiError(400, 'Message or messageTemplate is required');
  next();
};

const validateSendStudentFeeReminder = (req, res, next) => {
  const { message, messageTemplate } = req.body || {};
  if (!messageTemplate && !message) throw new ApiError(400, 'Message is required');
  next();
};

export { validateSendFeeReminders, validateSendStudentFeeReminder };
export default { validateSendFeeReminders, validateSendStudentFeeReminder };
