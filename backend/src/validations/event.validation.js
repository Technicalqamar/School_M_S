import { ApiError } from '../utils/apiError.js';

const EVENT_CATEGORIES = [
  'Annual Function',
  'Sports Day',
  'Independence Day',
  'Teachers Day',
  'Parents Meeting',
  'Science Exhibition',
  'Seminar',
  'Workshop',
  'Competition',
  'Examination',
  'Orientation',
  'Cultural Program',
  'Other',
];

const EVENT_STATUSES = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];

const AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];

const EVENT_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_BANNER_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 20;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
};

const isValidTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return false;
  return TIME_REGEX.test(timeStr);
};

const isAfter = (timeA, timeB) => {
  const [hA, mA] = timeA.split(':').map(Number);
  const [hB, mB] = timeB.split(':').map(Number);
  return hA > hB || (hA === hB && mA > mB);
};

const isBefore = (timeA, timeB) => {
  const [hA, mA] = timeA.split(':').map(Number);
  const [hB, mB] = timeB.split(':').map(Number);
  return hA < hB || (hA === hB && mA < mB);
};

const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    const match = trimmed.match(/^data:image\/([a-zA-Z+]+);/);
    if (!match) return false;
    const ext = `.${match[1].replace('jpeg', 'jpg').replace('+xml', '')}`;
    return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
  }
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http')) {
    const ext = trimmed.substring(trimmed.lastIndexOf('.')).toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
  }
  return false;
};

const validateCreateEvent = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }
  const {
    name,
    category,
    date,
    startTime,
    endTime,
    venue,
    organizer,
    attendanceRequired,
    audience,
    description,
    status,
    color,
    academicYear,
  } = req.body;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'Event name is required');
  }
  if (name.trim().length < 3) {
    throw new ApiError(400, 'Event name must be at least 3 characters');
  }
  if (name.trim().length > 200) {
    throw new ApiError(400, 'Event name cannot exceed 200 characters');
  }

  if (!category) {
    throw new ApiError(400, 'Event category is required');
  }
  if (!EVENT_CATEGORIES.includes(category)) {
    throw new ApiError(400, `Invalid event category. Allowed: ${EVENT_CATEGORIES.join(', ')}`);
  }

  if (!date) {
    throw new ApiError(400, 'Event date is required');
  }
  if (!isValidDate(date)) {
    throw new ApiError(400, 'Invalid event date');
  }

  if (startTime !== undefined && startTime !== null && startTime.trim() !== '') {
    if (!isValidTime(startTime.trim())) {
      throw new ApiError(400, 'Invalid start time. Use HH:MM (24-hour) format');
    }
  }

  if (endTime !== undefined && endTime !== null && endTime.trim() !== '') {
    if (!isValidTime(endTime.trim())) {
      throw new ApiError(400, 'Invalid end time. Use HH:MM (24-hour) format');
    }
    if (startTime && startTime.trim() && isValidTime(startTime.trim())) {
      if (!isAfter(endTime.trim(), startTime.trim()) && endTime.trim() !== startTime.trim()) {
        throw new ApiError(400, 'End time must be after start time');
      }
      if (isBefore(endTime.trim(), startTime.trim())) {
        throw new ApiError(400, 'End time cannot be before start time');
      }
    }
  }

  if (venue !== undefined && venue !== null && venue.trim() !== '') {
    if (venue.trim().length > 200) {
      throw new ApiError(400, 'Venue cannot exceed 200 characters');
    }
  }

  if (organizer !== undefined && organizer !== null && organizer.trim() !== '') {
    if (organizer.trim().length > 100) {
      throw new ApiError(400, 'Organizer name cannot exceed 100 characters');
    }
  }

  if (attendanceRequired !== undefined && attendanceRequired !== null && attendanceRequired !== '') {
    if (!['Yes', 'No'].includes(attendanceRequired)) {
      throw new ApiError(400, 'Attendance required must be Yes or No');
    }
  }

  if (audience !== undefined && audience !== null && audience !== '') {
    if (!AUDIENCES.includes(audience)) {
      throw new ApiError(400, `Invalid audience. Allowed: ${AUDIENCES.join(', ')}`);
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      throw new ApiError(400, 'Description must be a string');
    }
    if (description.trim().length > 2000) {
      throw new ApiError(400, 'Description cannot exceed 2000 characters');
    }
  }

  if (status !== undefined && status !== null && status !== '') {
    if (!EVENT_STATUSES.includes(status)) {
      throw new ApiError(400, `Invalid event status. Allowed: ${EVENT_STATUSES.join(', ')}`);
    }
  }

  if (color !== undefined && color !== null && color !== '') {
    if (!EVENT_COLORS.includes(color)) {
      throw new ApiError(400, `Invalid event color. Allowed: ${EVENT_COLORS.join(', ')}`);
    }
  }

  if (!academicYear) {
    throw new ApiError(400, 'Academic year is required');
  }
  if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }

  if (req.file) {
    const ext = req.file.originalname
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        `Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed for banner image`,
      );
    }
    if (req.file.size > MAX_BANNER_SIZE) {
      throw new ApiError(400, `Banner image cannot exceed ${MAX_BANNER_SIZE / (1024 * 1024)}MB`);
    }
  }

  req.body.name = name.trim();
  req.body.category = category;
  req.body.date = new Date(date).toISOString().split('T')[0];
  if (startTime) req.body.startTime = startTime.trim();
  if (endTime) req.body.endTime = endTime.trim();
  if (venue) req.body.venue = venue.trim();
  if (organizer) req.body.organizer = organizer.trim();
  if (description) req.body.description = description.trim();
  req.body.academicYear = academicYear.trim();

  next();
};

const validateUpdateEvent = (req, res, next) => {
  if (!req.body) {
    throw new ApiError(400, 'Request body is required');
  }
  const {
    name,
    category,
    date,
    startTime,
    endTime,
    venue,
    organizer,
    attendanceRequired,
    audience,
    description,
    status,
    color,
    academicYear,
  } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Event name cannot be empty');
    }
    if (name.trim().length < 3) {
      throw new ApiError(400, 'Event name must be at least 3 characters');
    }
    if (name.trim().length > 200) {
      throw new ApiError(400, 'Event name cannot exceed 200 characters');
    }
    req.body.name = name.trim();
  }

  if (category !== undefined) {
    if (!EVENT_CATEGORIES.includes(category)) {
      throw new ApiError(400, `Invalid event category. Allowed: ${EVENT_CATEGORIES.join(', ')}`);
    }
  }

  if (date !== undefined) {
    if (!isValidDate(date)) {
      throw new ApiError(400, 'Invalid event date');
    }
    req.body.date = new Date(date).toISOString().split('T')[0];
  }

  if (startTime !== undefined) {
    if (startTime !== null && startTime.trim() !== '') {
      if (!isValidTime(startTime.trim())) {
        throw new ApiError(400, 'Invalid start time. Use HH:MM (24-hour) format');
      }
      req.body.startTime = startTime.trim();
    }
  }

  if (endTime !== undefined) {
    if (endTime !== null && endTime.trim() !== '') {
      if (!isValidTime(endTime.trim())) {
        throw new ApiError(400, 'Invalid end time. Use HH:MM (24-hour) format');
      }
      const effectiveStart = (startTime !== undefined && startTime !== null && startTime.trim())
        ? startTime.trim()
        : null;
      if (effectiveStart && isBefore(endTime.trim(), effectiveStart)) {
        throw new ApiError(400, 'End time cannot be before start time');
      }
      req.body.endTime = endTime.trim();
    }
  }

  if (venue !== undefined) {
    if (venue !== null && venue.trim() !== '') {
      if (venue.trim().length > 200) {
        throw new ApiError(400, 'Venue cannot exceed 200 characters');
      }
      req.body.venue = venue.trim();
    }
  }

  if (organizer !== undefined) {
    if (organizer !== null && organizer.trim() !== '') {
      if (organizer.trim().length > 100) {
        throw new ApiError(400, 'Organizer name cannot exceed 100 characters');
      }
      req.body.organizer = organizer.trim();
    }
  }

  if (attendanceRequired !== undefined) {
    if (attendanceRequired !== null && attendanceRequired !== '') {
      if (!['Yes', 'No'].includes(attendanceRequired)) {
        throw new ApiError(400, 'Attendance required must be Yes or No');
      }
    }
  }

  if (audience !== undefined) {
    if (audience !== null && audience !== '') {
      if (!AUDIENCES.includes(audience)) {
        throw new ApiError(400, `Invalid audience. Allowed: ${AUDIENCES.join(', ')}`);
      }
    }
  }

  if (description !== undefined) {
    if (description !== null && typeof description === 'string') {
      if (description.trim().length > 2000) {
        throw new ApiError(400, 'Description cannot exceed 2000 characters');
      }
      req.body.description = description.trim();
    }
  }

  if (status !== undefined) {
    if (status !== null && status !== '') {
      if (!EVENT_STATUSES.includes(status)) {
        throw new ApiError(400, `Invalid event status. Allowed: ${EVENT_STATUSES.join(', ')}`);
      }
    }
  }

  if (color !== undefined) {
    if (color !== null && color !== '') {
      if (!EVENT_COLORS.includes(color)) {
        throw new ApiError(400, `Invalid event color. Allowed: ${EVENT_COLORS.join(', ')}`);
      }
    }
  }

  if (academicYear !== undefined) {
    if (!ACADEMIC_YEAR_REGEX.test(academicYear.trim())) {
      throw new ApiError(400, 'Invalid academic year format');
    }
    req.body.academicYear = academicYear.trim();
  }

  if (req.file) {
    const ext = req.file.originalname
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        `Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed for banner image`,
      );
    }
    if (req.file.size > MAX_BANNER_SIZE) {
      throw new ApiError(400, `Banner image cannot exceed ${MAX_BANNER_SIZE / (1024 * 1024)}MB`);
    }
  }

  next();
};

const validateEventId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) {
    throw new ApiError(400, 'Event ID is required');
  }
  next();
};

export { validateCreateEvent, validateUpdateEvent, validateEventId };
