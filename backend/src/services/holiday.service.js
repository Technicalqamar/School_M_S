import Holiday from '../models/holiday.model.js';
import { ApiError } from '../utils/apiError.js';

const createHoliday = async (data, userId) => {
  const { startDate, endDate } = data;

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const startDateDisplay = start.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const endDateDisplay = end.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const diffTime = Math.abs(end - start);
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  try {
    const holiday = await Holiday.create({
      ...data,
      startDate: startDate,
      endDate: endDate,
      startDateDisplay,
      endDateDisplay,
      totalDays,
      createdBy: userId,
    });

    return holiday;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllHolidays = async (filters = {}) => {
  const {
    type,
    status,
    appliesTo,
    academicYear,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
  } = filters;

  const filter = {};

  if (type) filter.type = type;
  if (status) filter.status = status;
  if (appliesTo) filter.appliesTo = appliesTo;
  if (academicYear) filter.academicYear = academicYear;

  if (fromDate || toDate) {
    if (fromDate) filter.startDate = { ...filter.startDate, $gte: fromDate };
    if (toDate) filter.endDate = { ...filter.endDate, $lte: toDate };
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [holidays, totalItems] = await Promise.all([
    Holiday.find(filter)
      .populate({ path: 'createdBy', select: 'fullName' })
      .sort({ startDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Holiday.countDocuments(filter),
  ]);

  return {
    holidays,
    pagination: {
      currentPage,
      totalPages: Math.ceil(totalItems / itemsPerPage),
      totalItems,
    },
  };
};

const getHolidayById = async (id) => {
  const holiday = await Holiday.findById(id)
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();

  if (!holiday) {
    throw new ApiError(404, 'Holiday not found');
  }

  return holiday;
};

const getHolidayAcademicYears = async () => {
  const years = await Holiday.distinct('academicYear');

  return years.sort();
};

const updateHoliday = async (id, data) => {
  const existing = await Holiday.findById(id);

  if (!existing) {
    throw new ApiError(404, 'Holiday not found');
  }

  const updateFields = { ...data };

  if (data.startDate || data.endDate) {
    const start = data.startDate
      ? new Date(data.startDate + 'T00:00:00')
      : new Date(existing.startDate + 'T00:00:00');
    const end = data.endDate
      ? new Date(data.endDate + 'T00:00:00')
      : new Date(existing.endDate + 'T00:00:00');

    updateFields.startDateDisplay = start.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    updateFields.endDateDisplay = end.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const diffTime = Math.abs(end - start);
    updateFields.totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  try {
    const updated = await Holiday.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    return updated;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteHoliday = async (id) => {
  const holiday = await Holiday.findById(id);

  if (!holiday) {
    throw new ApiError(404, 'Holiday not found');
  }

  await Holiday.findByIdAndDelete(id);

  return holiday;
};

export default {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  getHolidayAcademicYears,
  updateHoliday,
  deleteHoliday,
};
