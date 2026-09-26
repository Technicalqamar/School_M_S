import { ApiError } from '../utils/apiError.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const validateAssignSubjectsToClass = (req, res, next) => {
  const { className, academicYear, subjectIds } = req.body;

  if (!className || !className.trim()) {
    throw new ApiError(400, 'Class name is required');
  }

  if (!academicYear || !academicYear.trim()) {
    throw new ApiError(400, 'Academic year is required');
  }

  if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }

  if (!Array.isArray(subjectIds)) {
    throw new ApiError(400, 'subjectIds must be an array');
  }

  req.body.className = className.trim();
  req.body.academicYear = academicYear.trim();

  next();
};

const validateCreateSubject = (req, res, next) => {
  const { subjectName, status, description } = req.body;

  if (!subjectName || !subjectName.trim()) {
    throw new ApiError(400, 'Subject name is required');
  }

  if (status !== undefined) {
    const normalizedStatus = status.trim();
    if (!['Active', 'Inactive'].includes(normalizedStatus)) {
      throw new ApiError(400, 'Status must be either Active or Inactive');
    }
    req.body.status = normalizedStatus;
  }

  if (description !== undefined) {
    req.body.description = description.trim();
  }

  req.body.subjectName = subjectName.trim();

  next();
};

const validateUpdateSubject = (req, res, next) => {
  const { subjectName, status, description } = req.body;

  if (!subjectName && status === undefined && description === undefined) {
    throw new ApiError(400, 'At least one field (subjectName, status, description) must be provided');
  }

  if (subjectName !== undefined) {
    if (!subjectName.trim()) {
      throw new ApiError(400, 'Subject name cannot be empty');
    }
    req.body.subjectName = subjectName.trim();
  }

  if (status !== undefined) {
    if (!status.trim()) {
      throw new ApiError(400, 'Status cannot be empty');
    }
    const normalizedStatus = status.trim();
    if (!['Active', 'Inactive'].includes(normalizedStatus)) {
      throw new ApiError(400, 'Status must be either Active or Inactive');
    }
    req.body.status = normalizedStatus;
  }

  if (description !== undefined) {
    req.body.description = description.trim();
  }

  next();
};

export { validateCreateSubject, validateUpdateSubject, validateAssignSubjectsToClass };
