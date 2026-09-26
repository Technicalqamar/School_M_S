import express from 'express';
import { filterStudentsForPromotion, promoteStudents, getPromotionHistory, getStudentPromotions, deleteStudentPromotion, reversePromotion } from '../controllers/studentPromotion.controller.js';
import { validatePromoteStudents, validatePromotionHistoryQuery } from '../validations/studentPromotion.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/promotion/filter',
  protect,
  authorize('admin'),
  filterStudentsForPromotion,
);

router.post(
  '/promote',
  protect,
  authorize('admin'),
  validatePromoteStudents,
  promoteStudents,
);

router.get(
  '/promotion-history',
  protect,
  authorize('admin'),
  validatePromotionHistoryQuery,
  getPromotionHistory,
);

router.get(
  '/promotions',
  protect,
  authorize('admin'),
  getStudentPromotions,
);

router.delete(
  '/promotions/:id',
  protect,
  authorize('admin'),
  deleteStudentPromotion,
);

router.post(
  '/promotions/:id/reverse',
  protect,
  authorize('admin'),
  reversePromotion,
);

export default router;
