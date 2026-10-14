import express from 'express';
import {
  createFeeStructure,
  getAllFeeStructures,
  updateFeeStructure,
  deleteFeeStructure,
} from '../controllers/feeStructure.controller.js';
import { validateCreateFeeStructure, validateUpdateFeeStructure } from '../validations/feeStructure.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('fee-management', 'fee-structure'),
  getAllFeeStructures,
);

router.post(
  '/',
  protect,
  requireModuleAccess('fee-management', 'fee-structure'),
  validateCreateFeeStructure,
  createFeeStructure,
);

router.put(
  '/:id',
  protect,
  requireModuleAccess('fee-management', 'fee-structure'),
  validateUpdateFeeStructure,
  updateFeeStructure,
);

router.delete(
  '/:id',
  protect,
  requireModuleAccess('fee-management', 'fee-structure'),
  deleteFeeStructure,
);

export default router;