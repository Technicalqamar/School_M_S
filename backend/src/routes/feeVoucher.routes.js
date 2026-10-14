import express from 'express';
import { generateVouchers, getVouchers, getVoucher } from '../controllers/feeVoucher.controller.js';
import {
  validateGenerateVouchers,
  validateFetchVouchers,
  validateVoucherIdParam,
} from '../validations/feeVoucher.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('fee-management', 'voucher-generation'),
  validateFetchVouchers,
  getVouchers,
);

router.post(
  '/',
  protect,
  requireModuleAccess('fee-management', 'voucher-generation'),
  validateGenerateVouchers,
  generateVouchers,
);

router.get(
  '/:voucherId',
  protect,
  requireModuleAccess('fee-management', 'voucher-generation'),
  validateVoucherIdParam,
  getVoucher,
);

export default router;