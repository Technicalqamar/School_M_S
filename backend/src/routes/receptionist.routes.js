import express from 'express';
import {
  createReceptionist,
  getAllReceptionists,
  getReceptionistById,
  updateReceptionist,
  updateReceptionistStatus,
  updateReceptionistPermissions,
  resetReceptionistPassword,
  deleteReceptionist,
} from '../controllers/receptionist.controller.js';
import {
  validateCreateReceptionist,
  validateUpdateReceptionist,
  validateUpdatePermissions,
  validateReceptionistStatus,
  validateReceptionistPassword,
  validateReceptionistObjectId,
} from '../validations/receptionist.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Receptionist account management is Admin-only. Enforced server-side here, not
// merely hidden in the UI.
router.use(protect, authorize('admin'));

router.get('/', getAllReceptionists);
router.post('/', validateCreateReceptionist, createReceptionist);

router.get('/:id', validateReceptionistObjectId, getReceptionistById);
router.put('/:id', validateReceptionistObjectId, validateUpdateReceptionist, updateReceptionist);
router.patch('/:id/status', validateReceptionistObjectId, validateReceptionistStatus, updateReceptionistStatus);
router.patch('/:id/permissions', validateReceptionistObjectId, validateUpdatePermissions, updateReceptionistPermissions);
router.patch('/:id/password', validateReceptionistObjectId, validateReceptionistPassword, resetReceptionistPassword);
router.delete('/:id', validateReceptionistObjectId, deleteReceptionist);

export default router;
