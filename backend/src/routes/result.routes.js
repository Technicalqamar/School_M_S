import express from 'express';
import { getResult } from '../controllers/result.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getResult);

export default router;