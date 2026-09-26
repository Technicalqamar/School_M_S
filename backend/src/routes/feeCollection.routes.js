import express from 'express';
import { collectFee, getFeeCollections } from '../controllers/feeCollection.controller.js';
import { validateCollectFee } from '../validations/feeCollection.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getFeeCollections,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateCollectFee,
  collectFee,
);

export default router;