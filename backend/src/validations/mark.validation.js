import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const assertId = (value, label) => {
  if (value === undefined || value === null || value === '') {
    throw new ApiError(400, `${label} is required`);
  }
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ApiError(400, `Invalid ${label.toLowerCase()} id`);
  }
  return String(value);
};

const assertYear = (value) => {
  if (value === undefined || value === null || !String(value).trim()) {
    throw new ApiError(400, 'Academic year is required');
  }
  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

const assertClassName = (value) => {
  if (value === undefined || value === null || !String(value).trim()) {
    throw new ApiError(400, 'Class is required');
  }
  const className = String(value).trim();
  if (!VALID_CLASS_NAMES.includes(className)) {
    throw new ApiError(400, `Invalid class name. Allowed values: ${VALID_CLASS_NAMES.join(', ')}`);
  }
  return className;
};

const assertMarks = (value, label = 'Obtained marks') => {
  if (value === '' || value === null || value === undefined) {
    throw new ApiError(400, `${label} are required`);
  }
  const num = Number(value);
  if (isNaN(num)) {
    throw new ApiError(400, `Invalid ${label.toLowerCase()}`);
  }
  if (num < 0) {
    throw new ApiError(400, `${label} cannot be negative`);
  }
  return num;
};

const validateCreateMark = (req, res, next) => {
  const { examId, studentId, subjectId, academicYear, className, obtainedMarks, totalMarks, remarks } = req.body;

  req.body.examId = assertId(examId, 'Exam');
  req.body.studentId = assertId(studentId, 'Student');
  req.body.subjectId = assertId(subjectId, 'Subject');
  req.body.academicYear = assertYear(academicYear);
  req.body.className = assertClassName(className);
  req.body.obtainedMarks = assertMarks(obtainedMarks);

  if (totalMarks !== undefined && totalMarks !== null && totalMarks !== '') {
    const tm = Number(totalMarks);
    if (isNaN(tm) || tm <= 0) {
      throw new ApiError(400, 'Total marks must be a positive number');
    }
    if (req.body.obtainedMarks > tm) {
      throw new ApiError(400, 'Obtained marks cannot exceed total marks');
    }
    req.body.totalMarks = tm;
  }

  if (remarks !== undefined && remarks !== null) {
    req.body.remarks = String(remarks).trim();
  }

  next();
};

const validateUpdateMark = (req, res, next) => {
  const hasAny =
    req.body.examId !== undefined ||
    req.body.studentId !== undefined ||
    req.body.subjectId !== undefined ||
    req.body.academicYear !== undefined ||
    req.body.className !== undefined ||
    req.body.obtainedMarks !== undefined ||
    req.body.totalMarks !== undefined ||
    req.body.remarks !== undefined;

  if (!hasAny) {
    throw new ApiError(400, 'At least one field must be provided');
  }

  if (req.body.examId !== undefined) req.body.examId = assertId(req.body.examId, 'Exam');
  if (req.body.studentId !== undefined) req.body.studentId = assertId(req.body.studentId, 'Student');
  if (req.body.subjectId !== undefined) req.body.subjectId = assertId(req.body.subjectId, 'Subject');
  if (req.body.academicYear !== undefined) req.body.academicYear = assertYear(req.body.academicYear);
  if (req.body.className !== undefined) req.body.className = assertClassName(req.body.className);
  if (req.body.obtainedMarks !== undefined) req.body.obtainedMarks = assertMarks(req.body.obtainedMarks);

  if (req.body.totalMarks !== undefined) {
    if (req.body.totalMarks === null || req.body.totalMarks === '') {
      throw new ApiError(400, 'Total marks must be a positive number');
    }
    const tm = Number(req.body.totalMarks);
    if (isNaN(tm) || tm <= 0) {
      throw new ApiError(400, 'Total marks must be a positive number');
    }
    req.body.totalMarks = tm;
  }

  if (req.body.remarks !== undefined) {
    req.body.remarks = req.body.remarks === null ? '' : String(req.body.remarks).trim();
  }

  next();
};

const validateBulkMarks = (req, res, next) => {
  const { examId, subjectId, academicYear, className, entries } = req.body;

  req.body.examId = assertId(examId, 'Exam');
  req.body.subjectId = assertId(subjectId, 'Subject');
  req.body.academicYear = assertYear(academicYear);
  req.body.className = assertClassName(className);

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ApiError(400, 'At least one mark entry is required');
  }

  if (entries.length > 500) {
    throw new ApiError(400, 'Cannot save more than 500 marks in a single request');
  }

  const seen = new Set();
  const normalized = entries.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new ApiError(400, 'Each mark entry must be an object with studentId and obtainedMarks');
    }
    const studentId = assertId(entry.studentId, 'Student');
    const obtainedMarks = assertMarks(entry.obtainedMarks);
    const totalMarks =
      entry.totalMarks !== undefined && entry.totalMarks !== null && entry.totalMarks !== ''
        ? Number(entry.totalMarks)
        : undefined;

    if (totalMarks !== undefined) {
      if (isNaN(totalMarks) || totalMarks <= 0) {
        throw new ApiError(400, `Total marks must be a positive number for student ${studentId}`);
      }
      if (obtainedMarks > totalMarks) {
        throw new ApiError(400, `Obtained marks cannot exceed total marks for student ${studentId}`);
      }
    }

    const remarks =
      entry.remarks !== undefined && entry.remarks !== null ? String(entry.remarks).trim() : '';

    if (seen.has(studentId)) {
      throw new ApiError(400, `Duplicate student entry found: ${studentId}`);
    }
    seen.add(studentId);

    return { studentId, obtainedMarks, totalMarks, remarks };
  });

  req.body.entries = normalized;
  next();
};

export { validateCreateMark, validateUpdateMark, validateBulkMarks };