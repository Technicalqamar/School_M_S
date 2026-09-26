import { ApiError } from '../utils/apiError.js';

const HOLIDAY_TYPES = [
  'Public Holiday',
  'National Holiday',
  'Religious Holiday',
  'School Holiday',
  'Emergency Holiday',
  'Summer Vacation',
  'Winter Vacation',
  'Exam Break',
];

const HOLIDAY_STATUSES = ['Upcoming', 'Ongoing', 'Completed'];

const AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
};

const validateCreateHoliday = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }
  const { name, startDate, endDate, type, appliesTo, description, academicYear } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Holiday name is required');
  }
  if (name.trim().length < 3) {
    throw new ApiError(400, 'Holiday name must be at least 3 characters');
  }
  if (name.trim().length > 200) {
    throw new ApiError(400, 'Holiday name cannot exceed 200 characters');
  }

  if (!startDate) {
    throw new ApiError(400, 'Start date is required');
  }
  if (!isValidDate(startDate)) {
    throw new ApiError(400, 'Invalid start date');
  }

  if (!endDate) {
    throw new ApiError(400, 'End date is required');
  }
  if (!isValidDate(endDate)) {
    throw new ApiError(400, 'Invalid end date');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    throw new ApiError(400, 'End date cannot be before start date');
  }

  if (!type) {
    throw new ApiError(400, 'Holiday type is required');
  }
  if (!HOLIDAY_TYPES.includes(type)) {
    throw new ApiError(400, `Invalid holiday type. Allowed: ${HOLIDAY_TYPES.join(', ')}`);
  }

  if (appliesTo !== undefined && appliesTo !== null && appliesTo !== '') {
    if (!AUDIENCES.includes(appliesTo)) {
      throw new ApiError(400, `Invalid applies to. Allowed: ${AUDIENCES.join(', ')}`);
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      throw new ApiError(400, 'Description must be a string');
    }
    if (description.trim().length > 500) {
      throw new ApiError(400, 'Description cannot exceed 500 characters');
    }
  }

  if (!academicYear) {
    throw new ApiError(400, 'Academic year is required');
  }
  if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }

  const startDisplay = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const endDisplay = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const diffTime = Math.abs(end - start);
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  req.body.name = name.trim();
  req.body.startDate = start.toISOString().split('T')[0];
  req.body.endDate = end.toISOString().split('T')[0];
  req.body.startDateDisplay = startDisplay;
  req.body.endDateDisplay = endDisplay;
  req.body.totalDays = totalDays;
  req.body.academicYear = academicYear.trim();
  if (description) req.body.description = description.trim();

  next();
};

const validateUpdateHoliday = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }
  const { name, startDate, endDate, type, appliesTo, description, academicYear } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Holiday name cannot be empty');
    }
    if (name.trim().length < 3) {
      throw new ApiError(400, 'Holiday name must be at least 3 characters');
    }
    if (name.trim().length > 200) {
      throw new ApiError(400, 'Holiday name cannot exceed 200 characters');
    }
    req.body.name = name.trim();
  }

  if (startDate !== undefined) {
    if (!isValidDate(startDate)) {
      throw new ApiError(400, 'Invalid start date');
    }
    req.body.startDate = new Date(startDate).toISOString().split('T')[0];
  }

  if (endDate !== undefined) {
    if (!isValidDate(endDate)) {
      throw new ApiError(400, 'Invalid end date');
    }
    req.body.endDate = new Date(endDate).toISOString().split('T')[0];
  }

  if (startDate !== undefined && endDate !== undefined) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new ApiError(400, 'End date cannot be before start date');
    }
  }

  if (type !== undefined) {
    if (!HOLIDAY_TYPES.includes(type)) {
      throw new ApiError(400, `Invalid holiday type. Allowed: ${HOLIDAY_TYPES.join(', ')}`);
    }
  }

  if (appliesTo !== undefined) {
    if (appliesTo !== null && appliesTo !== '') {
      if (!AUDIENCES.includes(appliesTo)) {
        throw new ApiError(400, `Invalid applies to. Allowed: ${AUDIENCES.join(', ')}`);
      }
    }
  }

  if (description !== undefined) {
    if (description !== null && typeof description === 'string') {
      if (description.trim().length > 500) {
        throw new ApiError(400, 'Description cannot exceed 500 characters');
      }
      req.body.description = description.trim();
    }
  }

  if (academicYear !== undefined) {
    if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
      throw new ApiError(400, 'Invalid academic year format');
    }
    req.body.academicYear = academicYear.trim();
  }

  next();
};

const validateHolidayId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) {
    throw new ApiError(400, 'Holiday ID is required');
  }
  next();
};

export { validateCreateHoliday, validateUpdateHoliday, validateHolidayId };
