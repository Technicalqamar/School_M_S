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
  validateReceptionistObjectId,
  validateReceptionistPasswordReset,
} from '../validations/receptionist.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Receptionist account management is Admin-only. Enforced server-side here, not
// merely hidden in the UI: the `protect` + `authorize('admin')` mount rejects
// every other role before a handler runs, so a Receptionist can never create,
// edit, delete, re-assign permissions for, or reset the password of any
// receptionist account (including their own). The service performs a second
// `performerRole === 'admin'` check for the password reset as defence in depth.
// Passwords are only ever provided by an Admin (creation + reset); the hash is
// written by the UserAccount model and neither the plaintext nor the hash is
// ever returned or logged.
router.use(protect, authorize('admin'));

router.get('/', getAllReceptionists);
router.post('/', validateCreateReceptionist, createReceptionist);

router.get('/:id', validateReceptionistObjectId, getReceptionistById);
router.put('/:id', validateReceptionistObjectId, validateUpdateReceptionist, updateReceptionist);
router.patch('/:id/status', validateReceptionistObjectId, validateReceptionistStatus, updateReceptionistStatus);
router.patch('/:id/permissions', validateReceptionistObjectId, validateUpdatePermissions, updateReceptionistPermissions);
router.patch('/:id/reset-password', validateReceptionistObjectId, validateReceptionistPasswordReset, resetReceptionistPassword);
router.delete('/:id', validateReceptionistObjectId, deleteReceptionist);

export default router;