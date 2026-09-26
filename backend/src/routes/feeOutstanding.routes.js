import express from 'express';
import { getOutstandingDues } from '../controllers/feeOutstanding.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getOutstandingDues,
);

export default router;