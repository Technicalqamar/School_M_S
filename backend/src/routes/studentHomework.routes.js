import express from 'express';
import {
  getStudentAssignments,
  getStudentAssignment,
} from '../controllers/studentHomework.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Students can only READ their own class's assignments. No create/edit/delete
// routes are exposed, so students have no write access whatsoever.
router.get(
  '/',
  protect,
  authorize('student'),
  getStudentAssignments,
);

router.get(
  '/:id',
  protect,
  authorize('student'),
  getStudentAssignment,
);

export default router;