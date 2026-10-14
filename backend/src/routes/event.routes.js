import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  getEventAcademicYears,
  updateEvent,
  deleteEvent,
} from '../controllers/event.controller.js';
import { validateCreateEvent, validateUpdateEvent } from '../validations/event.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const eventUpload = createUploader('event-gallery');

router.get(
  '/calendar',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  (req, _res, next) => {
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/upcoming',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  (req, _res, next) => {
    req.query.status = 'Upcoming';
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/ongoing',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  (req, _res, next) => {
    req.query.status = 'Ongoing';
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/search',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  getAllEvents,
);

router.get(
  '/academic-year/:year',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  (req, _res, next) => {
    req.query.academicYear = req.params.year;
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/academic-years',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  getEventAcademicYears,
);

router.get(
  '/category/:category',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  (req, _res, next) => {
    req.query.category = req.params.category;
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/audience/:audience',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  (req, _res, next) => {
    req.query.audience = req.params.audience;
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  getAllEvents,
);

router.get(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'event-view'),
  getEventById,
);

router.post(
  '/',
  protect,
  requireActionAccess('events-and-holidays', 'event-create'),
  eventUpload.single('image'),
  validateCreateEvent,
  createEvent,
);

router.put(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'event-edit'),
  eventUpload.single('image'),
  validateUpdateEvent,
  updateEvent,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'event-delete'),
  deleteEvent,
);

export default router;
