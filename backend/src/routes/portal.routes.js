import express from 'express';
import { getPortalContext, endPortalAccess } from '../controllers/portalAccess.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/access/context', protect, getPortalContext);
router.post('/access/end', protect, endPortalAccess);

export default router;