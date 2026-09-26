import { ApiError } from '../utils/apiError.js';

const VALID_STATUSES = ['Present', 'Absent', 'Leave', 'Late'];
const VALID_METHODS = ['Manual', 'QR'];
const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;

const normalizeYear = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const validateSaveAttendance = (req, res, next) => {
  const { academicYear, date, records } = req.body;
  const normalizedYear = normalizeYear(academicYear) || String(new Date().getFullYear());

  if (!ACADEMIC_YEAR_REGEX.test(normalizedYear)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2026)');
  }

  if (!date) {
    throw new ApiError(400, 'Attendance date is required');
  }

  const attendanceDate = new Date(date);
  if (Number.isNaN(attendanceDate.getTime())) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  if (!records || !Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'At least one teacher attendance record is required');
  }

  for (const record of records) {
    if (!record.teacher) {
      throw new ApiError(400, 'Teacher reference is required for each record');
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

  req.body.academicYear = normalizedYear;
  req.body.date = attendanceDate.toISOString().split('T')[0];
  next();
};

const validateQrScan = (req, res, next) => {
  const { qrValue, academicYear, date } = req.body || {};

  if (!qrValue || typeof qrValue !== 'string' || !qrValue.trim()) {
    throw new ApiError(400, 'QR value is required');
  }

  if (qrValue.trim().length > 300) {
    throw new ApiError(400, 'QR value is too long (max 300 characters)');
  }

  const normalizedYear = normalizeYear(academicYear) || String(new Date().getFullYear());
  if (academicYear && !ACADEMIC_YEAR_REGEX.test(normalizedYear)) {
    throw new ApiError(400, 'Invalid academic year format');
  }

  if (date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, 'Invalid attendance date');
    }
  }

  req.body.qrValue = qrValue.trim();
  req.body.academicYear = normalizedYear;
  req.body.date = date ? new Date(date).toISOString().split('T')[0] : undefined;

  next();
};

const validateGetAttendance = (req, res, next) => {
  const { academicYear, date } = req.query;

  if (academicYear && !ACADEMIC_YEAR_REGEX.test(String(academicYear).trim())) {
    throw new ApiError(400, 'Invalid academic year format');
  }

  if (date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, 'Invalid date format');
    }
  }

  next();
};

export { validateSaveAttendance, validateGetAttendance, validateQrScan };
