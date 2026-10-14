import express from 'express';
import { collectFee, getFeeCollections } from '../controllers/feeCollection.controller.js';
import { validateCollectFee } from '../validations/feeCollection.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('fee-management', 'collect-fee'),
  getFeeCollections,
);

router.post(
  '/',
  protect,
  requireModuleAccess('fee-management', 'collect-fee'),
  validateCollectFee,
  collectFee,
);

export default router;