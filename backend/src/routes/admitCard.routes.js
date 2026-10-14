import express from 'express';
import { getAdmitCard } from '../controllers/admitCard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.use(protect, requireModuleAccess('exam-management', 'admit-card'));

router.get('/', getAdmitCard);

export default router;
