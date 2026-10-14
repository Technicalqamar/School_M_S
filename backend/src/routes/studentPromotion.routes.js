import express from 'express';
import { filterStudentsForPromotion, promoteStudents, getPromotionHistory, getStudentPromotions, deleteStudentPromotion, reversePromotion } from '../controllers/studentPromotion.controller.js';
import { validatePromoteStudents, validatePromotionHistoryQuery } from '../validations/studentPromotion.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess, requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/promotion/filter',
  protect,
  requireActionAccess('student-management', 'student-promote'),
  filterStudentsForPromotion,
);

router.post(
  '/promote',
  protect,
  requireActionAccess('student-management', 'student-promote'),
  validatePromoteStudents,
  promoteStudents,
);

router.get(
  '/promotion-history',
  protect,
  requireModuleAccess('student-management', 'promotion-history'),
  validatePromotionHistoryQuery,
  getPromotionHistory,
);

router.get(
  '/promotions',
  protect,
  requireModuleAccess('student-management', 'promotion-history'),
  getStudentPromotions,
);

router.delete(
  '/promotions/:id',
  protect,
  requireActionAccess('student-management', 'student-promote'),
  deleteStudentPromotion,
);

router.post(
  '/promotions/:id/reverse',
  protect,
  requireActionAccess('student-management', 'student-promote'),
  reversePromotion,
);

export default router;