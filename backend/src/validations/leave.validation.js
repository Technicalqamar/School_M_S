import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const VALID_LEAVE_TYPES = ['Student', 'Teacher'];
const VALID_LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'];
const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;

const isValidDateStr = (value) => {
  if (!value || typeof value !== 'string') return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

const normalizeDateStr = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const validateAcademicYear = (value) => {
  if (!value || !value.trim()) {
    throw new ApiError(400, 'Academic year is required');
  }
  if (!ACADEMIC_YEAR_REGEX.test(value.trim())) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return value.trim();
};

const validatePersonRefs = (type, body) => {
  if (!VALID_LEAVE_TYPES.includes(type)) {
    throw new ApiError(400, `Invalid leave type. Allowed: ${VALID_LEAVE_TYPES.join(', ')}`);
  }
  if (type === 'Student') {
    const ref = body.student || body.studentId;
    if (!ref || (typeof ref === 'string' && !ref.trim())) {
      throw new ApiError(400, 'Student reference (student or studentId) is required for a Student leave');
    }
  } else {
    const ref = body.teacher || body.teacherId;
    if (!ref || (typeof ref === 'string' && !ref.trim())) {
      throw new ApiError(400, 'Teacher reference (teacher or teacherId) is required for a Teacher leave');
    }
  }
};

const validateDates = (body, requireAll = false) => {
  const { fromDate, toDate } = body;

  if (requireAll) {
    if (!fromDate) throw new ApiError(400, 'From date is required');
    if (!toDate) throw new ApiError(400, 'To date is required');
  }

  if (fromDate !== undefined && fromDate !== null && fromDate !== '') {
    if (!isValidDateStr(fromDate)) throw new ApiError(400, 'Invalid from date');
    body.fromDate = normalizeDateStr(fromDate);
  }

  if (toDate !== undefined && toDate !== null && toDate !== '') {
    if (!isValidDateStr(toDate)) throw new ApiError(400, 'Invalid to date');
    body.toDate = normalizeDateStr(toDate);
  }

  if (body.fromDate && body.toDate && body.toDate < body.fromDate) {
    throw new ApiError(400, 'To date cannot be before from date');
  }
};

const validateReason = (reason) => {
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'Leave reason is required');
  }
  if (reason.trim().length < 3) {
    throw new ApiError(400, 'Leave reason must be at least 3 characters');
  }
  if (reason.trim().length > 500) {
    throw new ApiError(400, 'Leave reason cannot exceed 500 characters');
  }
  return reason.trim();
};

const validateStatus = (status) => {
  if (status !== undefined && status !== null && status !== '') {
    if (!VALID_LEAVE_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid leave status. Allowed: ${VALID_LEAVE_STATUSES.join(', ')}`);
    }
  }
};

const validateClass = (value) => {
  const cls = String(value ?? '').trim();
  if (cls === '') return '';
  if (!VALID_CLASS_NAMES.includes(cls)) {
    throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
  }
  return cls;
};

const validateCreateLeave = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required');
  }

  if (!req.body.type || !req.body.type.trim()) {
    throw new ApiError(400, 'Leave type is required');
  }
  const normalizedType = req.body.type.trim();
  validatePersonRefs(normalizedType, req.body);

  req.body.academicYear = validateAcademicYear(req.body.academicYear);
  validateDates(req.body, true);
  req.body.reason = validateReason(req.body.reason);
  validateStatus(req.body.status);
  req.body.class = validateClass(req.body.class);
  req.body.type = normalizedType;

  next();
};

const validateUpdateLeave = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required');
  }

  if (req.body.type !== undefined && req.body.type !== null) {
    if (!req.body.type.trim()) {
      throw new ApiError(400, 'Leave type cannot be empty');
    }
    validatePersonRefs(req.body.type.trim(), req.body);
    req.body.type = req.body.type.trim();
  }

  if (req.body.academicYear !== undefined && req.body.academicYear !== null) {
    req.body.academicYear = validateAcademicYear(req.body.academicYear);
  }

  validateDates(req.body, false);

  if (req.body.reason !== undefined && req.body.reason !== null && req.body.reason !== '') {
    req.body.reason = validateReason(req.body.reason);
  }
  if (req.body.reason !== undefined && req.body.reason !== null && req.body.reason === '') {
    throw new ApiError(400, 'Leave reason cannot be empty');
  }

  validateStatus(req.body.status);

  if (req.body.class !== undefined && req.body.class !== null) {
    req.body.class = validateClass(req.body.class);
  }

  next();
};

const validateLeaveId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) {
    throw new ApiError(400, 'Leave ID is required');
  }
  if (!mongoose.isValidObjectId(id.trim())) {
    throw new ApiError(400, 'Invalid leave ID format');
  }
  req.params.id = id.trim();
  next();
};

const validateCheckLeave = (req, res, next) => {
  const { type, personId, date } = req.query || {};

  if (!type || !type.trim()) {
    throw new ApiError(400, 'Leave type is required');
  }
  if (!VALID_LEAVE_TYPES.includes(type.trim())) {
    throw new ApiError(400, `Invalid leave type. Allowed: ${VALID_LEAVE_TYPES.join(', ')}`);
  }
  if (!personId || !String(personId).trim()) {
    throw new ApiError(400, 'personId is required');
  }
  if (!date || !isValidDateStr(String(date))) {
    throw new ApiError(400, 'A valid date is required');
  }

  req.query.type = type.trim();
  req.query.personId = String(personId).trim();
  req.query.date = normalizeDateStr(String(date));

  next();
};

export { validateCreateLeave, validateUpdateLeave, validateLeaveId, validateCheckLeave };