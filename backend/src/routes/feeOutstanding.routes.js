import express from 'express';
import { getOutstandingDues } from '../controllers/feeOutstanding.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('fee-management', 'outstanding-dues'),
  getOutstandingDues,
);

export default router;