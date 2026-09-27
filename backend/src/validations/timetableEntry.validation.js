import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const assertValidObjectId = (value, label) => {
  if (value === undefined || value === null || !String(value).trim()) {
    throw new ApiError(400, `${label} is required`);
  }
  const id = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${label.toLowerCase()} id`);
  }
  return id;
};

// Source-of-truth rule: the teacher is always resolved from the existing
// Class Management assignment. A client-provided teacherId is rejected loudly
// instead of being silently ignored.
const assertNoManualTeacher = (body) => {
  const teacherId = body.teacherId;
  if (teacherId !== undefined && teacherId !== null && String(teacherId).trim() !== '') {
    throw new ApiError(
      400,
      'Teacher cannot be manually assigned. The teacher is resolved automatically from the class teacher assignment',
    );
  }
};

const normalizeAcademicYear = (value, normalized) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return normalized;
  }
  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  normalized.academicYear = year;
  return normalized;
};

const validateCreateTimetableEntry = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }

  const { classId, timeSlotId, subjectId, academicYear } = req.body;

  assertNoManualTeacher(req.body);

  const normalized = {
    classId: assertValidObjectId(classId, 'Class'),
    timeSlotId: assertValidObjectId(timeSlotId, 'Time slot'),
    subjectId: assertValidObjectId(subjectId, 'Subject'),
  };

  // academicYear is optional on create: when absent it is resolved from the
  // central/default academic year source (school settings) in the service layer.
  normalizeAcademicYear(academicYear, normalized);

  req.body = { ...req.body, ...normalized };
  next();
};

const validateUpdateTimetableEntry = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }

  const { classId, timeSlotId, subjectId, academicYear } = req.body;

  const hasField =
    classId !== undefined || timeSlotId !== undefined || subjectId !== undefined || academicYear !== undefined;

  if (!hasField) {
    throw new ApiError(400, 'At least one field (academicYear, classId, timeSlotId, subjectId) must be provided');
  }

  assertNoManualTeacher(req.body);

  const normalized = {};

  if (classId !== undefined) normalized.classId = assertValidObjectId(classId, 'Class');
  if (timeSlotId !== undefined) normalized.timeSlotId = assertValidObjectId(timeSlotId, 'Time slot');
  if (subjectId !== undefined) normalized.subjectId = assertValidObjectId(subjectId, 'Subject');

  normalizeAcademicYear(academicYear, normalized);

  req.body = { ...req.body, ...normalized };
  next();
};

const validateTimetableEntryId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !String(id).trim()) {
    throw new ApiError(400, 'Timetable entry ID is required');
  }
  if (!mongoose.Types.ObjectId.isValid(String(id).trim())) {
    throw new ApiError(400, 'Invalid timetable entry id');
  }

  req.params.id = String(id).trim();
  next();
};

export { validateCreateTimetableEntry, validateUpdateTimetableEntry, validateTimetableEntryId };