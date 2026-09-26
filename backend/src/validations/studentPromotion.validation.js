import { ApiError } from '../utils/apiError.js';

const ALLOWED_CLASSES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const validatePromoteStudents = (req, res, next) => {
  const { studentIds, fromClass, toClass, fromAcademicYear, toAcademicYear } = req.body;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ApiError(400, 'At least one student must be selected');
  }

  if (!fromClass) {
    throw new ApiError(400, 'From class is required');
  }
  if (!ALLOWED_CLASSES.includes(fromClass)) {
    throw new ApiError(400, 'Invalid from class');
  }

  if (!toClass) {
    throw new ApiError(400, 'To class is required');
  }
  if (!ALLOWED_CLASSES.includes(toClass)) {
    throw new ApiError(400, 'Invalid to class');
  }

  if (fromClass === toClass) {
    throw new ApiError(400, 'From class and to class must be different');
  }

  if (!fromAcademicYear) {
    throw new ApiError(400, 'From academic year is required');
  }
  if (!/^\d{4}$/.test(fromAcademicYear)) {
    throw new ApiError(400, 'Invalid from academic year format');
  }

  if (!toAcademicYear) {
    throw new ApiError(400, 'To academic year is required');
  }
  if (!/^\d{4}$/.test(toAcademicYear)) {
    throw new ApiError(400, 'Invalid to academic year format');
  }

  if (Number(toAcademicYear) <= Number(fromAcademicYear)) {
    throw new ApiError(400, 'To academic year must be greater than from academic year');
  }

  next();
};

const validatePromotionHistoryQuery = (req, res, next) => {
  const { studentId, fromClass, toClass, fromAcademicYear, toAcademicYear } = req.query;

  if (studentId && typeof studentId !== 'string') {
    throw new ApiError(400, 'Invalid studentId filter');
  }
  if (fromClass && !ALLOWED_CLASSES.includes(fromClass)) {
    throw new ApiError(400, 'Invalid from class filter');
  }
  if (toClass && !ALLOWED_CLASSES.includes(toClass)) {
    throw new ApiError(400, 'Invalid to class filter');
  }
  if (fromAcademicYear && !/^\d{4}$/.test(fromAcademicYear)) {
    throw new ApiError(400, 'Invalid from academic year filter');
  }
  if (toAcademicYear && !/^\d{4}$/.test(toAcademicYear)) {
    throw new ApiError(400, 'Invalid to academic year filter');
  }

  next();
};

export { validatePromoteStudents, validatePromotionHistoryQuery };
