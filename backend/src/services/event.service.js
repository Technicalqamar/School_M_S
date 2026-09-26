import Event from '../models/event.model.js';
import { ApiError } from '../utils/apiError.js';

const createEvent = async (data, userId) => {
  const { date } = data;

  const dateDisplay = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  try {
    const event = await Event.create({
      ...data,
      dateDisplay,
      createdBy: userId,
    });

    return event;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllEvents = async (filters = {}) => {
  const {
    category,
    status,
    audience,
    attendanceRequired,
    academicYear,
    search,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
  } = filters;

  const filter = {};

  if (category) filter.category = category;
  if (status) filter.status = status;
  if (audience) filter.audience = audience;
  if (attendanceRequired) filter.attendanceRequired = attendanceRequired;
  if (academicYear) filter.academicYear = academicYear;

  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = fromDate;
    if (toDate) filter.date.$lte = toDate;
  }

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { venue: { $regex: term, $options: 'i' } },
      { organizer: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
    ];
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [events, totalItems] = await Promise.all([
    Event.find(filter)
      .populate({ path: 'createdBy', select: 'fullName' })
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Event.countDocuments(filter),
  ]);

  return {
    events,
    pagination: {
      currentPage,
      totalPages: Math.ceil(totalItems / itemsPerPage),
      totalItems,
    },
  };
};

const getEventById = async (id) => {
  const event = await Event.findById(id)
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  return event;
};

const getEventAcademicYears = async () => {
  const years = await Event.distinct('academicYear');

  return years.sort();
};

const updateEvent = async (id, data, userId) => {
  const existing = await Event.findById(id);

  if (!existing) {
    throw new ApiError(404, 'Event not found');
  }

  if (data.date) {
    data.dateDisplay = new Date(data.date + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  try {
    const updated = await Event.findByIdAndUpdate(id, { ...data, createdBy: userId }, {
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

const deleteEvent = async (id) => {
  const event = await Event.findById(id);

  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  await Event.findByIdAndDelete(id);

  return event;
};

export default {
  createEvent,
  getAllEvents,
  getEventById,
  getEventAcademicYears,
  updateEvent,
  deleteEvent,
};
