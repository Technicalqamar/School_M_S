import express from 'express';
import { getTeacherDashboardData } from '../controllers/teacherDashboard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('teacher'),
  getTeacherDashboardData,
);

export default router;