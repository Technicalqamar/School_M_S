import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const VALID_SCOPES = ['Overall', 'Class', 'Student'];

const CLASS_OPTIONS = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10',
];

const FEE_TYPE_MAP = {
  'All Fees': 'All Fees',
  'Monthly Fee': 'Monthly Fee',
  'Admission Fee': 'Admission Fee',
  'Examination Fee': 'Examination Fee',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDate = (value, field) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const date = String(value).trim();

  if (!DATE_PATTERN.test(date)) {
    throw new ApiError(400, `${field} must be a valid date in YYYY-MM-DD format`);
  }

  const [year, month, day] = date.split('-').map((part) => Number(part));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day) {
    throw new ApiError(400, `${field} must be a valid date`);
  }

  return date;
};

const validateReportQuery = (req, res, next) => {
  const { scope, academicYear, className, studentId, feeType, dateFrom, dateTo } = req.query;

  if (!scope || !VALID_SCOPES.includes(scope)) {
    throw new ApiError(400, 'A valid report scope is required (Overall, Class or Student)');
  }

  if (academicYear !== undefined && academicYear !== null && academicYear !== '') {
    const year = String(academicYear).trim();

    if (!/^\d{4}$/.test(year)) {
      throw new ApiError(400, 'Academic year must be a valid 4-digit year');
    }

    req.query.academicYear = year;
  } else {
    req.query.academicYear = '';
  }

  if (scope === 'Class') {
    const selectedClass = String(className || '').trim();

    if (!selectedClass || !CLASS_OPTIONS.includes(selectedClass)) {
      throw new ApiError(400, 'A valid class is required for the class report');
    }

    req.query.className = selectedClass;
  }

  if (scope === 'Student') {
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      throw new ApiError(400, 'A valid student ID is required for the student report');
    }
  }

  if (feeType !== undefined && feeType !== null && feeType !== '') {
    const selectedFeeType = String(feeType).trim();

    if (!FEE_TYPE_MAP[selectedFeeType]) {
      throw new ApiError(400, 'Invalid fee type. Allowed values: All Fees, Monthly Fee, Admission Fee, Examination Fee');
    }

    req.query.feeType = selectedFeeType;
  } else {
    req.query.feeType = 'All Fees';
  }

  req.query.dateFrom = parseDate(dateFrom, 'Date From');
  req.query.dateTo = parseDate(dateTo, 'Date To');

  if (req.query.dateFrom && req.query.dateTo && req.query.dateFrom > req.query.dateTo) {
    throw new ApiError(400, 'Date From cannot be after Date To');
  }

  next();
};

const validateStudentSearchQuery = (req, res, next) => {
  const query = String(req.query.query || '').trim();

  if (!query) {
    throw new ApiError(400, 'Search query is required');
  }

  req.query.query = query;

  next();
};

export { validateReportQuery, validateStudentSearchQuery };