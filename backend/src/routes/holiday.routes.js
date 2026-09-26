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
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/calendar',
  protect,
  authorize('admin'),
  (req, _res, next) => {
    req.query.limit = '500';
    next();
  },
  getAllHolidays,
);

router.get(
  '/type/:type',
  protect,
  authorize('admin'),
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
  authorize('admin'),
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
  authorize('admin'),
  getHolidayAcademicYears,
);

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllHolidays,
);

router.get(
  '/:id',
  protect,
  authorize('admin'),
  getHolidayById,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateHoliday,
  createHoliday,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateHoliday,
  updateHoliday,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteHoliday,
);

export default router;
