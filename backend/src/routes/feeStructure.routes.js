import express from 'express';
import {
  createFeeStructure,
  getAllFeeStructures,
  updateFeeStructure,
  deleteFeeStructure,
} from '../controllers/feeStructure.controller.js';
import { validateCreateFeeStructure, validateUpdateFeeStructure } from '../validations/feeStructure.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getAllFeeStructures,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCreateFeeStructure,
  createFeeStructure,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateUpdateFeeStructure,
  updateFeeStructure,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteFeeStructure,
);

export default router;