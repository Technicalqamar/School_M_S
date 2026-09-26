import express from 'express';
import {
  createAssignment,
  getTeacherAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
} from '../controllers/teacherHomework.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.post(
  '/',
  protect,
  authorize('teacher'),
  createAssignment,
);

router.get(
  '/',
  protect,
  authorize('teacher'),
  getTeacherAssignments,
);

router.get(
  '/:id',
  protect,
  authorize('teacher'),
  getAssignment,
);

router.patch(
  '/:id',
  protect,
  authorize('teacher'),
  updateAssignment,
);

router.delete(
  '/:id',
  protect,
  authorize('teacher'),
  deleteAssignment,
);

export default router;