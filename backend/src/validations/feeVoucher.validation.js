import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const VOUCHER_CLASSES = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const VOUCHER_STATUSES = ['Generated', 'Cancelled'];

const validateAcademicYear = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const year = String(value).trim();
  if (!/^\d{4}$/.test(year)) {
    throw new ApiError(400, 'Academic year must be a valid year (e.g. 2026)');
  }
  return year;
};

const validateGenerateVouchers = (req, res, next) => {
  const { classes, month, academicYear, dueDate } = req.body;

  if (!Array.isArray(classes) || classes.length === 0) {
    throw new ApiError(400, 'At least one class is required');
  }

  const uniqueClasses = [...new Set(classes)];

  if (uniqueClasses.length !== classes.length) {
    throw new ApiError(400, 'Duplicate classes are not allowed');
  }

  for (const className of uniqueClasses) {
    if (!VOUCHER_CLASSES.includes(className)) {
      throw new ApiError(400, `Invalid class: ${className}`);
    }
  }

  if (!month || !MONTHS.includes(month)) {
    throw new ApiError(400, 'Valid month is required');
  }

  req.body.academicYear = validateAcademicYear(academicYear);

  if (dueDate === undefined || dueDate === null || dueDate === '') {
    throw new ApiError(400, 'Voucher due date is required');
  }

  const parsedDueDate = new Date(dueDate);

  if (Number.isNaN(parsedDueDate.getTime())) {
    throw new ApiError(400, 'Valid voucher due date is required');
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (
    parsedDueDate.getFullYear() !== today.getFullYear() ||
    parsedDueDate.getMonth() !== today.getMonth() ||
    parsedDueDate < startOfToday
  ) {
    throw new ApiError(400, 'Voucher due date must be within the current month and not in the past');
  }

  req.body.classes = uniqueClasses;
  req.body.dueDate = parsedDueDate;

  next();
};

const validateFetchVouchers = (req, res, next) => {
  if (req.query.academicYear) {
    req.query.academicYear = validateAcademicYear(req.query.academicYear);
  }

  if (req.query.month && !MONTHS.includes(req.query.month)) {
    throw new ApiError(400, 'Invalid month filter');
  }

  if (req.query.className !== undefined && (typeof req.query.className !== 'string' || req.query.className.trim() === '')) {
    throw new ApiError(400, 'Invalid class filter');
  }

  if (req.query.voucherStatus && !VOUCHER_STATUSES.includes(req.query.voucherStatus)) {
    throw new ApiError(400, 'Invalid voucher status filter');
  }

  if (req.query.studentId && !mongoose.Types.ObjectId.isValid(req.query.studentId)) {
    throw new ApiError(400, 'Valid student ID is required');
  }

  next();
};

const validateVoucherIdParam = (req, res, next) => {
  const { voucherId } = req.params;

  if (!voucherId || !/^[A-Za-z0-9-]+$/.test(voucherId)) {
    throw new ApiError(400, 'Valid voucher ID is required');
  }

  next();
};

export { validateGenerateVouchers, validateFetchVouchers, validateVoucherIdParam, VOUCHER_CLASSES };