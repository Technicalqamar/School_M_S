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
import { authorize } from '../middlewares/role.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const eventUpload = createUploader('event-gallery');

router.get(
  '/calendar',
  protect,
  authorize('admin'),
  (req, _res, next) => {
    req.query.limit = '500';
    next();
  },
  getAllEvents,
);

router.get(
  '/upcoming',
  protect,
  authorize('admin'),
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
  authorize('admin'),
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
  authorize('admin'),
  getAllEvents,
);

router.get(
  '/academic-year/:year',
  protect,
  authorize('admin'),
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
  authorize('admin'),
  getEventAcademicYears,
);

router.get(
  '/category/:category',
  protect,
  authorize('admin'),
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
  authorize('admin'),
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
  authorize('admin'),
  getAllEvents,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  getEventById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  eventUpload.single('image'),
  validateCreateEvent,
  createEvent,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  eventUpload.single('image'),
  validateUpdateEvent,
  updateEvent,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteEvent,
);

export default router;
