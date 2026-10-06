import express from 'express';
import {
  createNotice,
  getNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
} from '../controllers/notice.controller.js';
import {
  validateCreateNotice,
  validateUpdateNotice,
  validateListNotices,
  validateNoticeId,
} from '../validations/notice.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), validateListNotices, getNotices);
router.post('/', protect, authorize('admin'), validateCreateNotice, createNotice);
router.get('/:id', protect, authorize('admin'), validateNoticeId, getNoticeById);
router.put('/:id', protect, authorize('admin'), validateUpdateNotice, updateNotice);
router.delete('/:id', protect, authorize('admin'), validateNoticeId, deleteNotice);

export default router;