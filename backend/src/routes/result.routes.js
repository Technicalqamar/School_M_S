import express from 'express';
import { getResult } from '../controllers/result.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// The Results page (and its Result History tab) reads generated results for a
// class/student; both live under the exam-management module.
router.use(protect, requireModuleAccess('exam-management', 'results'));

router.get('/', getResult);

export default router;