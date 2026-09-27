import { ApiError } from '../utils/apiError.js';
import mongoose from 'mongoose';
import TimeSlot from '../models/timeSlot.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

// Central/default academic year straight from school settings (never hard-coded).
const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear).trim();
  }

  return String(new Date().getFullYear());
};

// Resolve the effective academic year: explicit value takes precedence, otherwise
// the central/default year from school settings is used.
const resolveAcademicYear = async (value) => {
  if (value === undefined || value === null || !String(value).trim()) {
    return getCurrentAcademicYear();
  }

  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

const assertValidId = (id) => {
  if (!id || !String(id).trim() || !isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid time slot id');
  }
};

// Time strings are HH:mm zero-padded, so lexicographic comparison equals chronological order.
const timeToMinutes = (value) => {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
};

const assertTimesValid = (startTime, endTime) => {
  const start = String(startTime ?? '').trim();
  const end = String(endTime ?? '').trim();

  if (!start || !end) {
    throw new ApiError(400, 'Both start time and end time are required');
  }
  if (!TIME_REGEX.test(start) || !TIME_REGEX.test(end)) {
    throw new ApiError(400, 'Time values must be in HH:mm format');
  }
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    throw new ApiError(400, 'End time must be after start time');
  }
};

// Any existing slot in the same academic year whose range overlaps the given one.
// Per the half-open convention [startTime, endTime), adjacent slots (one ends exactly
// when the next starts) are allowed; identical/overlapping ranges are conflicts.
const overlapFilter = (academicYear, startTime, endTime, excludeId = null) => {
  const filter = {
    academicYear,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return filter;
};

const createTimeSlot = async (data, userId) => {
  const academicYear = await resolveAcademicYear(data.academicYear);
  const startTime = String(data.startTime ?? '').trim();
  const endTime = String(data.endTime ?? '').trim();

  assertTimesValid(startTime, endTime);

  const conflicting = await TimeSlot.findOne(overlapFilter(academicYear, startTime, endTime)).lean();
  if (conflicting) {
    throw new ApiError(409, 'A time slot already exists for this time range in the selected academic year');
  }

  try {
    return await TimeSlot.create({
      ...data,
      academicYear,
      startTime,
      endTime,
      createdBy: userId,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A time slot already exists for this time range in the selected academic year');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllTimeSlots = async (filters = {}) => {
  const { academicYear, type, status, page = 1, limit = 10 } = filters;

  const filter = {};
  if (academicYear !== undefined && academicYear !== null && String(academicYear).trim()) {
    const year = String(academicYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(year)) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }
    filter.academicYear = year;
  } else {
    // Open on the central/default academic year when no filter is supplied.
    filter.academicYear = await getCurrentAcademicYear();
  }

  if (type) filter.type = type;
  if (status) filter.status = status;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [timeSlots, totalItems] = await Promise.all([
    TimeSlot.find(filter)
      .sort({ startTime: 1, createdAt: 1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    TimeSlot.countDocuments(filter),
  ]);

  return {
    timeSlots,
    pagination: {
      currentPage,
      totalPages: Math.ceil(totalItems / itemsPerPage),
      totalItems,
    },
  };
};

const getTimeSlotById = async (id) => {
  assertValidId(id);

  const timeSlot = await TimeSlot.findById(id).lean();
  if (!timeSlot) {
    throw new ApiError(404, 'Time slot not found');
  }

  return timeSlot;
};

const updateTimeSlot = async (id, data, userId) => {
  assertValidId(id);

  const existing = await TimeSlot.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Time slot not found');
  }

  const academicYear =
    data.academicYear !== undefined && data.academicYear !== null && String(data.academicYear).trim()
      ? await resolveAcademicYear(data.academicYear)
      : existing.academicYear;

  const startTime = String(data.startTime ?? existing.startTime).trim();
  const endTime = String(data.endTime ?? existing.endTime).trim();

  assertTimesValid(startTime, endTime);

  const conflicting = await TimeSlot.findOne(overlapFilter(academicYear, startTime, endTime, existing._id)).lean();
  if (conflicting) {
    throw new ApiError(409, 'A time slot already exists for this time range in the selected academic year');
  }

  const updateFields = {
    ...data,
    academicYear,
    startTime,
    endTime,
    updatedBy: userId,
  };
  delete updateFields.createdBy;

  try {
    return await TimeSlot.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A time slot already exists for this time range in the selected academic year');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteTimeSlot = async (id) => {
  assertValidId(id);

  const timeSlot = await TimeSlot.findById(id);
  if (!timeSlot) {
    throw new ApiError(404, 'Time slot not found');
  }

  await TimeSlot.findByIdAndDelete(id);

  return timeSlot;
};

export default {
  createTimeSlot,
  getAllTimeSlots,
  getTimeSlotById,
  updateTimeSlot,
  deleteTimeSlot,
};