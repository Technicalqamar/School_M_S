import { asyncHandler } from '../utils/asyncHandler.js';
import eventService from '../services/event.service.js';
import eventGalleryService from '../services/eventGallery.service.js';

const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body, req.user?._id);

  if (req.file) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    await eventGalleryService.upsertBanner(event._id, req.file, baseUrl, req.user?._id);
  }

  const [attached] = await eventGalleryService.attachGalleryToEvents([event.toObject()]);

  return res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: { event: attached },
  });
});

const getAllEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getAllEvents(req.query);
  const events = await eventGalleryService.attachGalleryToEvents(result.events);

  return res.status(200).json({
    success: true,
    message: 'Events fetched successfully',
    data: { events, pagination: result.pagination },
  });
});

const getEventById = asyncHandler(async (req, res) => {
  const event = await eventService.getEventById(req.params.id);
  const [attached] = await eventGalleryService.attachGalleryToEvents([event]);

  return res.status(200).json({
    success: true,
    message: 'Event fetched successfully',
    data: { event: attached },
  });
});

const getEventAcademicYears = asyncHandler(async (req, res) => {
  const years = await eventService.getEventAcademicYears();

  return res.status(200).json({
    success: true,
    message: 'Academic years fetched successfully',
    data: { years },
  });
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.id, req.body, req.user?._id);

  if (req.file) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    await eventGalleryService.upsertBanner(event._id, req.file, baseUrl, req.user?._id);
  }

  const [attached] = await eventGalleryService.attachGalleryToEvents([event.toObject()]);

  return res.status(200).json({
    success: true,
    message: 'Event updated successfully',
    data: { event: attached },
  });
});

const deleteEvent = asyncHandler(async (req, res) => {
  await eventGalleryService.deleteGalleryByEvent(req.params.id);
  await eventService.deleteEvent(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Event deleted successfully',
  });
});

export {
  createEvent,
  getAllEvents,
  getEventById,
  getEventAcademicYears,
  updateEvent,
  deleteEvent,
};
