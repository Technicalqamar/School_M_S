import express from 'express';
import {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  updateAccountStatus,
  updatePassword,
  deleteAccount,
  getAvailableProfiles,
} from '../controllers/userAccount.controller.js';
import {
  validateCreateAccount,
  validateUpdateAccount,
  validateObjectId,
  validateStatusUpdate,
  validatePasswordUpdate,
  validateRoleParam,
} from '../validations/userAccount.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/available/:role', validateRoleParam, getAvailableProfiles);

router.get('/', getAllAccounts);

router.post('/', validateCreateAccount, createAccount);

router.get('/:id', validateObjectId, getAccountById);

router.put('/:id', validateObjectId, validateUpdateAccount, updateAccount);

router.patch('/:id/status', validateObjectId, validateStatusUpdate, updateAccountStatus);

router.patch('/:id/password', validateObjectId, validatePasswordUpdate, updatePassword);

router.delete('/:id', validateObjectId, deleteAccount);

export default router;
