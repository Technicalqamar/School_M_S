import express from 'express';
import { getDesign, saveDesign } from '../controllers/timetableDesign.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  authorize('admin'),
  getDesign,
);

router.put(
  '/',
  protect,
  authorize('admin'),
  saveDesign,
);

export default router;
