import express from 'express';
import {
  createMark,
  getAllMarks,
  getMarkById,
  updateMark,
  bulkSaveMarks,
  deleteMark,
} from '../controllers/mark.controller.js';
import { validateCreateMark, validateUpdateMark, validateBulkMarks } from '../validations/mark.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getAllMarks);

router.post('/bulk', validateBulkMarks, bulkSaveMarks);

router.get('/:id', getMarkById);

router.delete('/:id', deleteMark);

router.put('/:id', validateUpdateMark, updateMark);

router.post('/', validateCreateMark, createMark);

export default router;