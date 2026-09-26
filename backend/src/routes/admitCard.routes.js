import express from 'express';
import { getAdmitCard } from '../controllers/admitCard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getAdmitCard);

export default router;
