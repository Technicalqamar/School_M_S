import express from 'express';
import { setSecurityLock, verifySecurityLock, changeSecurityLock } from '../controllers/securityLock.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.post('/set', protect, authorize('admin'), setSecurityLock);
router.post('/verify', protect, authorize('admin'), verifySecurityLock);
router.post('/change', protect, authorize('admin'), changeSecurityLock);

export default router;
