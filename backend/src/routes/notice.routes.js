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
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get('/', protect, requireActionAccess('communication', 'notices-view'), validateListNotices, getNotices);
router.post('/', protect, requireActionAccess('communication', 'notices-create'), validateCreateNotice, createNotice);
router.get('/:id', protect, requireActionAccess('communication', 'notices-view'), validateNoticeId, getNoticeById);
router.put('/:id', protect, requireActionAccess('communication', 'notices-edit'), validateUpdateNotice, updateNotice);
router.delete('/:id', protect, requireActionAccess('communication', 'notices-delete'), validateNoticeId, deleteNotice);

export default router;