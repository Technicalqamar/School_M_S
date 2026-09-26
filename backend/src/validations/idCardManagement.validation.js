import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const VALID_CARD_STATUSES = ['All', 'Pending', 'Generated', 'Printed'];
const VALID_TEMPLATES = ['vertical', 'horizontal'];
const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const validateAcademicYear = (value, fieldName = 'Academic year') => {
  if (!value) return;
  if (typeof value !== 'string' || !ACADEMIC_YEAR_REGEX.test(value.trim())) {
    throw new ApiError(400, `Invalid ${fieldName} format. Use a valid year (e.g. 2025)`);
  }
};

const validateClassName = (value) => {
  if (!value) return;
  if (value !== 'All Classes' && !VALID_CLASS_NAMES.includes(value)) {
    throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
  }
};

const validateObjectIdList = (ids, fieldName = 'studentIds') => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, `${fieldName} must be a non-empty array`);
  }
  for (const id of ids) {
    if (typeof id !== 'string' || !OBJECT_ID_REGEX.test(id)) {
      throw new ApiError(400, `Invalid student ID in ${fieldName}: ${id}`);
    }
  }
};

const validateGetStudents = (req, res, next) => {
  const { academicYear, class: className, status, search } = req.query;

  validateAcademicYear(academicYear);
  validateClassName(className);

  if (status && !VALID_CARD_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid card status. Allowed: ${VALID_CARD_STATUSES.join(', ')}`);
  }

  if (search !== undefined && typeof search !== 'string') {
    throw new ApiError(400, 'Search must be a string');
  }

  next();
};

const validateGenerate = (req, res, next) => {
  const { academicYear, class: className, studentIds, regenerate } = req.body || {};

  validateAcademicYear(academicYear);
  validateClassName(className);

  if (!academicYear && !(Array.isArray(studentIds) && studentIds.length > 0)) {
    throw new ApiError(400, 'Either academic year or studentIds is required');
  }

  if (studentIds) {
    validateObjectIdList(studentIds);
  }

  if (regenerate !== undefined && typeof regenerate !== 'boolean') {
    throw new ApiError(400, 'regenerate must be a boolean');
  }

  next();
};

const validateRegenerate = (req, res, next) => {
  const { studentId } = req.params;

  if (!studentId || !OBJECT_ID_REGEX.test(studentId)) {
    throw new ApiError(400, 'Invalid student ID');
  }

  next();
};

const validateMarkPrinted = (req, res, next) => {
  const { studentIds } = req.body || {};

  validateObjectIdList(studentIds);

  next();
};

const validateUpdateDesign = (req, res, next) => {
  const { studentId } = req.params;
  const { template, frontDesign, backDesign } = req.body || {};

  if (!studentId || !OBJECT_ID_REGEX.test(studentId)) {
    throw new ApiError(400, 'Invalid student ID');
  }

  if (template && !VALID_TEMPLATES.includes(template)) {
    throw new ApiError(400, `Invalid template. Allowed: ${VALID_TEMPLATES.join(', ')}`);
  }

  if (frontDesign !== undefined && (typeof frontDesign !== 'object' || Array.isArray(frontDesign))) {
    throw new ApiError(400, 'frontDesign must be an object');
  }

  if (backDesign !== undefined && (typeof backDesign !== 'object' || Array.isArray(backDesign))) {
    throw new ApiError(400, 'backDesign must be an object');
  }

  if (!template && !frontDesign && !backDesign) {
    throw new ApiError(400, 'Provide at least one of template, frontDesign or backDesign');
  }

  next();
};

export {
  validateGetStudents,
  validateGenerate,
  validateRegenerate,
  validateMarkPrinted,
  validateUpdateDesign,
};