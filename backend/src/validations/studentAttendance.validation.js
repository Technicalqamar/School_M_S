import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const VALID_STATUSES = ['Present', 'Absent', 'Leave', 'Late'];
const VALID_METHODS = ['Manual', 'QR'];
const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;

const validateSaveAttendance = (req, res, next) => {
  const { academicYear, class: className, date, records } = req.body;

  if (!academicYear || !academicYear.trim()) {
    throw new ApiError(400, 'Academic year is required');
  }

  if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }

  if (className !== undefined && className !== null && className.trim() !== '') {
    if (!VALID_CLASS_NAMES.includes(className.trim())) {
      throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
    }
  }

  if (!date) {
    throw new ApiError(400, 'Attendance date is required');
  }

  const attendanceDate = new Date(date);
  if (isNaN(attendanceDate.getTime())) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  if (!records || !Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'At least one attendance record is required');
  }

  for (const record of records) {
    if (!record.student) {
      throw new ApiError(400, 'Student reference is required for each record');
    }

    if (!record.status || !VALID_STATUSES.includes(record.status)) {
      throw new ApiError(400, `Invalid status '${record.status}'. Allowed: ${VALID_STATUSES.join(', ')}`);
    }

    if (record.method && !VALID_METHODS.includes(record.method)) {
      throw new ApiError(400, `Invalid method '${record.method}'. Allowed: ${VALID_METHODS.join(', ')}`);
    }

    if (record.remarks !== undefined && record.remarks !== null) {
      if (typeof record.remarks !== 'string') {
        throw new ApiError(400, 'Remarks must be a string');
      }
      if (record.remarks.length > 500) {
        throw new ApiError(400, 'Remarks cannot exceed 500 characters');
      }
    }
  }

  req.body.academicYear = academicYear.trim();
  req.body.class = className ? className.trim() : '';
  req.body.date = attendanceDate.toISOString().split('T')[0];

  next();
};

const validateQrScan = (req, res, next) => {
  const { qrValue, academicYear, className, date } = req.body || {};

  if (!qrValue || typeof qrValue !== 'string' || !qrValue.trim()) {
    throw new ApiError(400, 'QR value is required');
  }

  if (qrValue.trim().length > 300) {
    throw new ApiError(400, 'QR value is too long (max 300 characters)');
  }

  if (academicYear && !ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format');
  }

  if (className !== undefined && className !== null && className.trim() !== '') {
    if (!VALID_CLASS_NAMES.includes(className.trim()) && className.trim() !== 'All Classes') {
      throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
    }
  }

  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new ApiError(400, 'Invalid attendance date');
    }
  }

  req.body.qrValue = qrValue.trim();
  req.body.date = date ? new Date(date).toISOString().split('T')[0] : undefined;

  next();
};

const validateGetAttendance = (req, res, next) => {
  const { academicYear, class: className, date } = req.query;

  if (academicYear && !ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format');
  }

  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
  }

  next();
};

export { validateSaveAttendance, validateGetAttendance, validateQrScan };
