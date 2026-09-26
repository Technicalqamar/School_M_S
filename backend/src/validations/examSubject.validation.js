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

const assertPositiveNumber = (value, label) => {
  const num = Number(value);
  if (value === '' || value === null || value === undefined || isNaN(num) || num <= 0) {
    throw new ApiError(400, `Enter valid ${label.toLowerCase()}`);
  }
  return num;
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

const validateCreateExamSubject = (req, res, next) => {
  const { examId, subjectId, academicYear, className, totalMarks, passingMarks, description, status } = req.body;

  req.body.examId = assertId(examId, 'Exam');
  req.body.subjectId = assertId(subjectId, 'Subject');
  req.body.academicYear = assertYear(academicYear);
  req.body.className = assertClassName(className);
  req.body.totalMarks = assertPositiveNumber(totalMarks, 'Total marks');
  req.body.status = assertStatus(status);

  const pass = Number(passingMarks);
  if (passingMarks === '' || passingMarks === null || passingMarks === undefined || isNaN(pass) || pass < 0) {
    throw new ApiError(400, 'Enter valid passing marks');
  }
  if (pass > req.body.totalMarks) {
    throw new ApiError(400, 'Passing marks cannot exceed total marks');
  }
  req.body.passingMarks = pass;

  if (description !== undefined && description !== null) {
    req.body.description = String(description).trim();
  }

  next();
};

const validateUpdateExamSubject = (req, res, next) => {
  const hasAny =
    req.body.examId !== undefined ||
    req.body.subjectId !== undefined ||
    req.body.academicYear !== undefined ||
    req.body.className !== undefined ||
    req.body.totalMarks !== undefined ||
    req.body.passingMarks !== undefined ||
    req.body.description !== undefined ||
    req.body.status !== undefined;

  if (!hasAny) {
    throw new ApiError(400, 'At least one field must be provided');
  }

  if (req.body.examId !== undefined) req.body.examId = assertId(req.body.examId, 'Exam');
  if (req.body.subjectId !== undefined) req.body.subjectId = assertId(req.body.subjectId, 'Subject');
  if (req.body.academicYear !== undefined) req.body.academicYear = assertYear(req.body.academicYear);
  if (req.body.className !== undefined) req.body.className = assertClassName(req.body.className);

  if (req.body.totalMarks !== undefined) {
    req.body.totalMarks = assertPositiveNumber(req.body.totalMarks, 'Total marks');
  }

  if (req.body.status !== undefined) {
    req.body.status = assertStatus(req.body.status);
  }

  if (req.body.passingMarks !== undefined) {
    const pass = Number(req.body.passingMarks);
    if (isNaN(pass) || pass < 0) {
      throw new ApiError(400, 'Enter valid passing marks');
    }
    req.body.passingMarks = pass;
  }

  if (req.body.totalMarks !== undefined && req.body.passingMarks !== undefined && req.body.passingMarks > req.body.totalMarks) {
    throw new ApiError(400, 'Passing marks cannot exceed total marks');
  }

  if (req.body.description !== undefined) {
    req.body.description = req.body.description === null ? '' : String(req.body.description).trim();
  }

  next();
};

export { validateCreateExamSubject, validateUpdateExamSubject };