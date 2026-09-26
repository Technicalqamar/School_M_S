import express from 'express';
import { getMyClasses } from '../controllers/teacherMyClasses.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('teacher'),
  getMyClasses,
);

export default router;