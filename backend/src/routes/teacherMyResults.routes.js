import express from 'express';
import { getMyResults } from '../controllers/teacherMyResults.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('teacher'),
  getMyResults,
);

export default router;