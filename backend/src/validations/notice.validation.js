import { ApiError } from '../utils/apiError.js';
import {
  SUPPORTED_COMMUNICATION_AUDIENCES,
  COMMUNICATION_CLASSES,
  ACADEMIC_YEAR_REGEX,
} from '../services/communicationTargeting.service.js';

const NOTICE_STATUSES = ['Draft', 'Published', 'Archived'];

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

// A notice can only be addressed to an audience that actually has a portal in
// this system. `Parents`/`Staff` are rejected here even though the model enum
// still lists them, because documents created before that cleanup are left
// untouched in the database rather than being migrated or deleted.
const validateAudience = (value) => {
  if (!value || !value.trim()) throw new ApiError(400, 'Audience is required');
  const audience = value.trim();
  if (!SUPPORTED_COMMUNICATION_AUDIENCES.includes(audience)) {
    throw new ApiError(400, `Invalid audience. Allowed: ${SUPPORTED_COMMUNICATION_AUDIENCES.join(', ')}`);
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

const validateCreateNotice = (req, res, next) => {
  if (!req.body) throw new ApiError(400, 'Request body is required');
  const { title, message, audience, classNames, status, academicYear } = req.body;

  if (!title || !title.trim()) throw new ApiError(400, 'Notice title is required');
  if (title.trim().length < 3) throw new ApiError(400, 'Notice title must be at least 3 characters');
  if (title.trim().length > 200) throw new ApiError(400, 'Notice title cannot exceed 200 characters');

  if (!message || !message.trim()) throw new ApiError(400, 'Notice message is required');
  if (message.trim().length < 3) throw new ApiError(400, 'Notice message must be at least 3 characters');
  if (message.trim().length > 5000) throw new ApiError(400, 'Notice message cannot exceed 5000 characters');

  if (status !== undefined && status !== null && String(status).trim() !== '') {
    if (!NOTICE_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid notice status. Allowed: ${NOTICE_STATUSES.join(', ')}`);
    }
  }

  req.body.title = title.trim();
  req.body.message = message.trim();
  req.body.audience = validateAudience(audience || 'All');
  req.body.classNames = validateClassNames(classNames);
  req.body.academicYear = validateAcademicYear(academicYear) || undefined;

  next();
};

const validateUpdateNotice = (req, res, next) => {
  if (!req.body) throw new ApiError(400, 'Request body is required');

  if (req.body.title !== undefined) {
    const title = req.body.title;
    if (typeof title !== 'string' || !title.trim()) throw new ApiError(400, 'Notice title cannot be empty');
    if (title.trim().length < 3) throw new ApiError(400, 'Notice title must be at least 3 characters');
    if (title.trim().length > 200) throw new ApiError(400, 'Notice title cannot exceed 200 characters');
    req.body.title = title.trim();
  }

  if (req.body.message !== undefined) {
    const message = req.body.message;
    if (typeof message !== 'string' || !message.trim()) throw new ApiError(400, 'Notice message cannot be empty');
    if (message.trim().length < 3) throw new ApiError(400, 'Notice message must be at least 3 characters');
    if (message.trim().length > 5000) throw new ApiError(400, 'Notice message cannot exceed 5000 characters');
    req.body.message = message.trim();
  }

  if (req.body.audience !== undefined) {
    req.body.audience = validateAudience(req.body.audience);
  }

  if (req.body.classNames !== undefined) {
    req.body.classNames = validateClassNames(req.body.classNames);
  }

  if (req.body.status !== undefined) {
    if (req.body.status !== null && String(req.body.status).trim() !== '') {
      if (!NOTICE_STATUSES.includes(req.body.status)) {
        throw new ApiError(400, `Invalid notice status. Allowed: ${NOTICE_STATUSES.join(', ')}`);
      }
      req.body.status = req.body.status.trim();
    }
  }

  if (req.body.academicYear !== undefined) {
    req.body.academicYear = validateAcademicYear(req.body.academicYear);
  }

  next();
};

const validateListNotices = (req, res, next) => {
  const { audience, status } = req.query;
  if (audience && audience !== 'All' && !SUPPORTED_COMMUNICATION_AUDIENCES.includes(audience)) {
    throw new ApiError(400, `Invalid audience filter. Allowed: ${SUPPORTED_COMMUNICATION_AUDIENCES.join(', ')}`);
  }
  if (status && status !== 'All' && !NOTICE_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status filter. Allowed: ${NOTICE_STATUSES.join(', ')}`);
  }
  next();
};

const validateNoticeId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) throw new ApiError(400, 'Notice ID is required');
  next();
};

export { validateCreateNotice, validateUpdateNotice, validateListNotices, validateNoticeId, NOTICE_STATUSES };