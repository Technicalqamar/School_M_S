import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

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

const assertDate = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ApiError(400, `${label} is required`);
  }
  const date = new Date(String(value));
  if (isNaN(date.getTime())) {
    throw new ApiError(400, `${label} must be a valid date`);
  }
  return date;
};

const assertTime = (value, label) => {
  if (value === undefined || value === null || !String(value).trim()) {
    throw new ApiError(400, `${label} is required`);
  }
  const time = String(value).trim();
  if (!TIME_REGEX.test(time)) {
    throw new ApiError(400, `${label} must be a valid time in 24-hour format (HH:MM)`);
  }
  return time;
};

const assertStatus = (value) => {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    const status = String(value).trim();
    if (!['Active', 'Inactive'].includes(status)) {
      throw new ApiError(400, 'Status must be either Active or Inactive');
    }
    return status;
  }
  return 'Active';
};

const validateCreateExamSchedule = (req, res, next) => {
  const {
    examId,
    subjectId,
    academicYear,
    className,
    examDate,
    startTime,
    endTime,
    room,
    notes,
    status,
  } = req.body;

  req.body.examId = assertId(examId, 'Exam');
  req.body.subjectId = assertId(subjectId, 'Subject');
  req.body.academicYear = assertYear(academicYear);
  req.body.className = assertClassName(className);
  req.body.examDate = assertDate(examDate, 'Exam date');
  req.body.startTime = assertTime(startTime, 'Start time');
  req.body.endTime = assertTime(endTime, 'End time');

  if (req.body.endTime <= req.body.startTime) {
    throw new ApiError(400, 'End time must be after start time');
  }

  if (room === undefined || room === null || !String(room).trim()) {
    throw new ApiError(400, 'Room is required');
  }
  req.body.room = String(room).trim();

  if (notes !== undefined && notes !== null) {
    req.body.notes = String(notes).trim();
  }

  req.body.status = assertStatus(status);

  next();
};

const validateUpdateExamSchedule = (req, res, next) => {
  const hasAny =
    req.body.examId !== undefined ||
    req.body.subjectId !== undefined ||
    req.body.academicYear !== undefined ||
    req.body.className !== undefined ||
    req.body.examDate !== undefined ||
    req.body.startTime !== undefined ||
    req.body.endTime !== undefined ||
    req.body.room !== undefined ||
    req.body.notes !== undefined ||
    req.body.status !== undefined;

  if (!hasAny) {
    throw new ApiError(400, 'At least one field must be provided');
  }

  if (req.body.examId !== undefined) req.body.examId = assertId(req.body.examId, 'Exam');
  if (req.body.subjectId !== undefined) req.body.subjectId = assertId(req.body.subjectId, 'Subject');
  if (req.body.academicYear !== undefined) req.body.academicYear = assertYear(req.body.academicYear);
  if (req.body.className !== undefined) req.body.className = assertClassName(req.body.className);
  if (req.body.examDate !== undefined) req.body.examDate = assertDate(req.body.examDate, 'Exam date');
  if (req.body.startTime !== undefined) req.body.startTime = assertTime(req.body.startTime, 'Start time');
  if (req.body.endTime !== undefined) req.body.endTime = assertTime(req.body.endTime, 'End time');

  if (req.body.startTime !== undefined && req.body.endTime !== undefined && req.body.endTime <= req.body.startTime) {
    throw new ApiError(400, 'End time must be after start time');
  }

  if (req.body.room !== undefined) {
    req.body.room = req.body.room === null ? '' : String(req.body.room).trim();
  }

  if (req.body.notes !== undefined) {
    req.body.notes = req.body.notes === null ? '' : String(req.body.notes).trim();
  }

  if (req.body.status !== undefined) {
    req.body.status = assertStatus(req.body.status);
  }

  next();
};

export { validateCreateExamSchedule, validateUpdateExamSchedule };