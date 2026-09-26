import express from 'express';
import { generateVouchers, getVouchers, getVoucher } from '../controllers/feeVoucher.controller.js';
import {
  validateGenerateVouchers,
  validateFetchVouchers,
  validateVoucherIdParam,
} from '../validations/feeVoucher.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  validateFetchVouchers,
  getVouchers,
);

router.post(
  '/',
  protect,
  authorize('admin'),
  validateGenerateVouchers,
  generateVouchers,
);

router.get(
  '/:voucherId',
  protect,
  authorize('admin'),
  validateVoucherIdParam,
  getVoucher,
);

export default router;