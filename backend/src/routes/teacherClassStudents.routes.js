import express from 'express';
import { getClassStudents } from '../controllers/teacherClassStudents.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/:classId',
  protect,
  authorize('teacher'),
  getClassStudents,
);

export default router;