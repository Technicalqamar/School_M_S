import express from 'express';
import {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  getHolidayAcademicYears,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holiday.controller.js';
import { validateCreateHoliday, validateUpdateHoliday } from '../validations/holiday.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/calendar',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-view'),
  (req, _res, next) => {
    req.query.limit = '500';
    next();
  },
  getAllHolidays,
);

router.get(
  '/type/:type',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-view'),
  (req, _res, next) => {
    req.query.type = req.params.type;
    req.query.limit = '500';
    next();
  },
  getAllHolidays,
);

router.get(
  '/academic-year/:year',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-view'),
  (req, _res, next) => {
    req.query.academicYear = req.params.year;
    req.query.limit = '500';
    next();
  },
  getAllHolidays,
);

router.get(
  '/academic-years',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-view'),
  getHolidayAcademicYears,
);

router.get(
  '/',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-view'),
  getAllHolidays,
);

router.get(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-view'),
  getHolidayById,
);

router.post(
  '/',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-create'),
  validateCreateHoliday,
  createHoliday,
);

router.put(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-edit'),
  validateUpdateHoliday,
  updateHoliday,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('events-and-holidays', 'holiday-delete'),
  deleteHoliday,
);

export default router;
