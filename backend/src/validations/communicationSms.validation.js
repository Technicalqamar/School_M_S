import { ApiError } from '../utils/apiError.js';
import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_CLASSES,
  ACADEMIC_YEAR_REGEX,
} from '../services/communicationTargeting.service.js';

const SMS_STATUSES = ['Pending', 'Sent', 'Failed'];

const validateClassNames = (value, field = 'classNames') => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, `${field} must be an array of class names`);
  }
  const unique = [...new Set(value)];
  if (unique.length !== value.length) {
    throw new ApiError(400, `Duplicate class names are not allowed in ${field}`);
  }
  for (const className of unique) {
    if (typeof className !== 'string' || !className.trim()) {
      throw new ApiError(400, `${field} contains an empty class name`);
    }
    if (!COMMUNICATION_CLASSES.includes(className)) {
      throw new ApiError(400, `Invalid class name: ${className}. Allowed: ${COMMUNICATION_CLASSES.join(', ')}`);
    }
  }
  return unique;
};

const validateAudience = (value) => {
  if (!value || !value.trim()) throw new ApiError(400, 'Audience is required');
  const audience = value.trim();
  if (!COMMUNICATION_AUDIENCES.includes(audience)) {
    throw new ApiError(400, `Invalid audience. Allowed: ${COMMUNICATION_AUDIENCES.join(', ')}`);
  }
  return audience;
};

const validateAcademicYear = (value) => {
  if (value === undefined || value === null || !String(value).trim()) return undefined;
  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

const validateCreateSms = (req, res, next) => {
  if (!req.body) throw new ApiError(400, 'Request body is required');
  const { message, audience, classNames, status, academicYear } = req.body;

  if (!message || !message.trim()) throw new ApiError(400, 'SMS message is required');
  if (message.trim().length < 3) throw new ApiError(400, 'SMS message must be at least 3 characters');
  if (message.trim().length > 1600) throw new ApiError(400, 'SMS message cannot exceed 1600 characters');

  if (status !== undefined && status !== null && String(status).trim() !== '') {
    if (!SMS_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid SMS status. Allowed: ${SMS_STATUSES.join(', ')}`);
    }
  }

  req.body.message = message.trim();
  req.body.audience = validateAudience(audience || 'All');
  req.body.classNames = validateClassNames(classNames);
  req.body.academicYear = validateAcademicYear(academicYear) || undefined;

  next();
};

const validateUpdateSmsStatus = (req, res, next) => {
  if (!req.body) throw new ApiError(400, 'Request body is required');
  const { status } = req.body;
  if (!status || !status.trim()) throw new ApiError(400, 'SMS status is required');
  if (!SMS_STATUSES.includes(status.trim())) {
    throw new ApiError(400, `Invalid SMS status. Allowed: ${SMS_STATUSES.join(', ')}`);
  }
  req.body.status = status.trim();
  next();
};

const validateListSms = (req, res, next) => {
  const { audience, status } = req.query;
  if (audience && audience !== 'All' && !COMMUNICATION_AUDIENCES.includes(audience)) {
    throw new ApiError(400, `Invalid audience filter. Allowed: ${COMMUNICATION_AUDIENCES.join(', ')}`);
  }
  if (status && status !== 'All' && !SMS_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status filter. Allowed: ${SMS_STATUSES.join(', ')}`);
  }
  next();
};

const validateSmsId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) throw new ApiError(400, 'SMS ID is required');
  next();
};

export { validateCreateSms, validateUpdateSmsStatus, validateListSms, validateSmsId, SMS_STATUSES };