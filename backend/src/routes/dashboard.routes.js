import express from 'express';
import { getDashboardData } from '../controllers/dashboard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getDashboardData,
);

export default router;