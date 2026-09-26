import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori',
  'Nursery',
  'KG 1',
  'KG 2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
];

const EXAM_TYPES = ['Mid Term', 'Final Term'];

const EXAM_STATUSES = ['Active', 'Inactive'];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalized = value.trim();

  if (DATE_ONLY_REGEX.test(normalized)) {
    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
    return null;
  }

  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
};

const validateCreateExam = (req, res, next) => {
  const { name, type, academicYear, classes, startDate, endDate, description, status } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Exam name is required');
  }

  if (name.trim().length > 100) {
    throw new ApiError(400, 'Exam name cannot exceed 100 characters');
  }

  if (!type || !type.trim()) {
    throw new ApiError(400, 'Exam type is required');
  }

  const normalizedType = type.trim();
  if (!EXAM_TYPES.includes(normalizedType)) {
    throw new ApiError(400, `Invalid exam type. Allowed values: ${EXAM_TYPES.join(', ')}`);
  }

  if (!academicYear || !academicYear.trim()) {
    throw new ApiError(400, 'Academic year is required');
  }

  if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }

  if (!Array.isArray(classes) || classes.length === 0) {
    throw new ApiError(400, 'At least one class must be selected');
  }

  const normalizedClasses = classes.map((cls) => String(cls).trim());

  if (normalizedClasses.some((cls) => !VALID_CLASS_NAMES.includes(cls))) {
    throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
  }

  if (!startDate) {
    throw new ApiError(400, 'Start date is required');
  }

  const normalizedStartDate = parseDate(startDate);
  if (!normalizedStartDate) {
    throw new ApiError(400, 'Invalid start date. Use a valid date in YYYY-MM-DD format');
  }

  if (!endDate) {
    throw new ApiError(400, 'End date is required');
  }

  const normalizedEndDate = parseDate(endDate);
  if (!normalizedEndDate) {
    throw new ApiError(400, 'Invalid end date. Use a valid date in YYYY-MM-DD format');
  }

  if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
    throw new ApiError(400, 'End date must be after start date');
  }

  if (status !== undefined && status !== null && String(status).trim() !== '') {
    const normalizedStatus = String(status).trim();
    if (!EXAM_STATUSES.includes(normalizedStatus)) {
      throw new ApiError(400, 'Status must be either Active or Inactive');
    }
    req.body.status = normalizedStatus;
  } else {
    req.body.status = 'Active';
  }

  req.body.name = name.trim();
  req.body.type = normalizedType;
  req.body.academicYear = academicYear.trim();
  req.body.classes = [...new Set(normalizedClasses)];
  req.body.startDate = normalizedStartDate;
  req.body.endDate = normalizedEndDate;

  if (description !== undefined && description !== null) {
    req.body.description = String(description).trim();
  }

  next();
};

const validateUpdateExam = (req, res, next) => {
  const { name, type, academicYear, classes, startDate, endDate, description, status } = req.body;

  const hasAnyField =
    name !== undefined ||
    type !== undefined ||
    academicYear !== undefined ||
    classes !== undefined ||
    startDate !== undefined ||
    endDate !== undefined ||
    description !== undefined ||
    status !== undefined;

  if (!hasAnyField) {
    throw new ApiError(400, 'At least one field must be provided');
  }

  if (name !== undefined) {
    if (!name.trim()) {
      throw new ApiError(400, 'Exam name cannot be empty');
    }
    if (name.trim().length > 100) {
      throw new ApiError(400, 'Exam name cannot exceed 100 characters');
    }
    req.body.name = name.trim();
  }

  if (type !== undefined) {
    if (!type.trim()) {
      throw new ApiError(400, 'Exam type cannot be empty');
    }
    const normalizedType = type.trim();
    if (!EXAM_TYPES.includes(normalizedType)) {
      throw new ApiError(400, `Invalid exam type. Allowed values: ${EXAM_TYPES.join(', ')}`);
    }
    req.body.type = normalizedType;
  }

  if (academicYear !== undefined) {
    if (!academicYear.trim()) {
      throw new ApiError(400, 'Academic year cannot be empty');
    }
    if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }
    req.body.academicYear = academicYear.trim();
  }

  if (classes !== undefined) {
    if (!Array.isArray(classes) || classes.length === 0) {
      throw new ApiError(400, 'At least one class must be selected');
    }
    const normalizedClasses = classes.map((cls) => String(cls).trim());
    if (normalizedClasses.some((cls) => !VALID_CLASS_NAMES.includes(cls))) {
      throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
    }
    req.body.classes = [...new Set(normalizedClasses)];
  }

  const normalizedStartDate = startDate !== undefined && startDate !== null ? parseDate(startDate) : null;
  if (startDate !== undefined && startDate !== null) {
    if (!normalizedStartDate) {
      throw new ApiError(400, 'Invalid start date. Use a valid date in YYYY-MM-DD format');
    }
    req.body.startDate = normalizedStartDate;
  }

  const normalizedEndDate = endDate !== undefined && endDate !== null ? parseDate(endDate) : null;
  if (endDate !== undefined && endDate !== null) {
    if (!normalizedEndDate) {
      throw new ApiError(400, 'Invalid end date. Use a valid date in YYYY-MM-DD format');
    }
    req.body.endDate = normalizedEndDate;
  }

  if (normalizedStartDate && normalizedEndDate && normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
    throw new ApiError(400, 'End date must be after start date');
  }

  if (status !== undefined) {
    if (status === null || String(status).trim() === '') {
      throw new ApiError(400, 'Status cannot be empty');
    }
    const normalizedStatus = String(status).trim();
    if (!EXAM_STATUSES.includes(normalizedStatus)) {
      throw new ApiError(400, 'Status must be either Active or Inactive');
    }
    req.body.status = normalizedStatus;
  }

  if (description !== undefined) {
    if (description === null) {
      req.body.description = '';
    } else {
      req.body.description = String(description).trim();
    }
  }

  next();
};

export { validateCreateExam, validateUpdateExam };