import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const TIME_SLOT_TYPES = ['PERIOD', 'BREAK'];
const TIME_SLOT_STATUSES = ['Active', 'Inactive'];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;
// HH:mm (24-hour)
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeToMinutes = (value) => {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
};

const assertValidTime = (value, fieldLabel) => {
  if (value === undefined || value === null || !String(value).trim()) {
    throw new ApiError(400, `${fieldLabel} is required`);
  }
  if (!TIME_REGEX.test(String(value).trim())) {
    throw new ApiError(400, `${fieldLabel} must be in HH:mm format`);
  }
  return String(value).trim();
};

const validateCreateTimeSlot = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }
  const { academicYear, startTime, endTime, type, label, status } = req.body;

  const normalized = {};

  const start = assertValidTime(startTime, 'Start time');
  const end = assertValidTime(endTime, 'End time');

  if (timeToMinutes(end) <= timeToMinutes(start)) {
    throw new ApiError(400, 'End time must be after start time');
  }

  if (!type) {
    throw new ApiError(400, 'Time slot type is required');
  }
  if (!TIME_SLOT_TYPES.includes(type)) {
    throw new ApiError(400, `Invalid time slot type. Allowed: ${TIME_SLOT_TYPES.join(', ')}`);
  }

  // academicYear is optional on create: when absent it is resolved from the
  // central/default academic year source (school settings) in the service layer.
  if (academicYear !== undefined && academicYear !== null && String(academicYear).trim() !== '') {
    const year = String(academicYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(year)) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }
    normalized.academicYear = year;
  }

  if (label !== undefined) {
    if (label === null) {
      normalized.label = '';
    } else if (typeof label === 'string') {
      const trimmed = label.trim();
      if (trimmed.length > 100) {
        throw new ApiError(400, 'Label cannot exceed 100 characters');
      }
      normalized.label = trimmed;
    } else {
      throw new ApiError(400, 'Label must be a string');
    }
  }

  if (status !== undefined && status !== null && String(status).trim() !== '') {
    if (!TIME_SLOT_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid time slot status. Allowed: ${TIME_SLOT_STATUSES.join(', ')}`);
    }
    normalized.status = status;
  }

  req.body = { ...req.body, ...normalized, startTime: start, endTime: end };
  next();
};

const validateUpdateTimeSlot = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }
  const { academicYear, startTime, endTime, type, label, status } = req.body;

  const hasField =
    academicYear !== undefined ||
    startTime !== undefined ||
    endTime !== undefined ||
    type !== undefined ||
    label !== undefined ||
    status !== undefined;

  if (!hasField) {
    throw new ApiError(400, 'At least one field (academicYear, startTime, endTime, type, label, status) must be provided');
  }

  const normalized = {};

  if (startTime !== undefined) {
    normalized.startTime = assertValidTime(startTime, 'Start time');
  }
  if (endTime !== undefined) {
    normalized.endTime = assertValidTime(endTime, 'End time');
  }

  if (normalized.startTime !== undefined && normalized.endTime !== undefined) {
    if (timeToMinutes(normalized.endTime) <= timeToMinutes(normalized.startTime)) {
      throw new ApiError(400, 'End time must be after start time');
    }
  }

  if (type !== undefined) {
    if (!TIME_SLOT_TYPES.includes(type)) {
      throw new ApiError(400, `Invalid time slot type. Allowed: ${TIME_SLOT_TYPES.join(', ')}`);
    }
    normalized.type = type;
  }

  if (academicYear !== undefined) {
    if (academicYear !== null && String(academicYear).trim() !== '') {
      const year = String(academicYear).trim();
      if (!ACADEMIC_YEAR_REGEX.test(year)) {
        throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
      }
      normalized.academicYear = year;
    }
  }

  if (label !== undefined) {
    if (label === null) {
      normalized.label = '';
    } else if (typeof label === 'string') {
      const trimmed = label.trim();
      if (trimmed.length > 100) {
        throw new ApiError(400, 'Label cannot exceed 100 characters');
      }
      normalized.label = trimmed;
    } else {
      throw new ApiError(400, 'Label must be a string');
    }
  }

  if (status !== undefined && status !== null && String(status).trim() !== '') {
    if (!TIME_SLOT_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid time slot status. Allowed: ${TIME_SLOT_STATUSES.join(', ')}`);
    }
    normalized.status = status;
  }

  req.body = { ...req.body, ...normalized };
  next();
};

const validateTimeSlotId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !String(id).trim()) {
    throw new ApiError(400, 'Time slot ID is required');
  }
  if (!mongoose.Types.ObjectId.isValid(String(id).trim())) {
    throw new ApiError(400, 'Invalid time slot id');
  }
  req.params.id = String(id).trim();
  next();
};

export { validateCreateTimeSlot, validateUpdateTimeSlot, validateTimeSlotId };