import express from 'express';
import { getDashboardData } from '../controllers/dashboard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireModuleAccess('dashboard'),
  getDashboardData,
);

export default router;