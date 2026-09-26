import express from 'express';
import {
  getStudentFeeOverview,
  getStudentFeeHistory,
  getStudentVouchers,
  getStudentVoucher,
  getStudentReceipt,
} from '../controllers/studentFees.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Students can only READ their own fee information. No create, collect, edit,
// delete or voucher-generation routes are exposed, so students have no write
// access whatsoever at the API level.
router.get(
  '/overview',
  protect,
  authorize('student'),
  getStudentFeeOverview,
);

router.get(
  '/history',
  protect,
  authorize('student'),
  getStudentFeeHistory,
);

router.get(
  '/vouchers',
  protect,
  authorize('student'),
  getStudentVouchers,
);

router.get(
  '/vouchers/:id',
  protect,
  authorize('student'),
  getStudentVoucher,
);

router.get(
  '/receipts/:id',
  protect,
  authorize('student'),
  getStudentReceipt,
);

export default router;