import express from 'express';
import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  assignSubjectsToClass,
  getClassAssignments,
  getClassAssignmentYears,
} from '../controllers/subject.controller.js';
import { validateCreateSubject, validateUpdateSubject, validateAssignSubjectsToClass } from '../validations/subject.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get(
  '/',
  protect,
  requireActionAccess('subject-management', 'subject-view'),
  getAllSubjects,
);

router.post(
  '/assign-class',
  protect,
  requireActionAccess('subject-management', 'subject-assign'),
  validateAssignSubjectsToClass,
  assignSubjectsToClass,
);

router.get(
  '/assign-class',
  protect,
  requireActionAccess('subject-management', 'subject-view'),
  getClassAssignments,
);

router.get(
  '/assign-class/years',
  protect,
  requireActionAccess('subject-management', 'subject-view'),
  getClassAssignmentYears,
);

router.get(
  '/:id',
  protect,
  requireActionAccess('subject-management', 'subject-view'),
  getSubjectById,
);

router.post(
  '/',
  protect,
  requireActionAccess('subject-management', 'subject-create'),
  validateCreateSubject,
  createSubject,
);

router.put(
  '/:id',
  protect,
  requireActionAccess('subject-management', 'subject-edit'),
  validateUpdateSubject,
  updateSubject,
);

router.delete(
  '/:id',
  protect,
  requireActionAccess('subject-management', 'subject-delete'),
  deleteSubject,
);

export default router;