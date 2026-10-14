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
import { requireModuleAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// All User Accounts endpoints require an authenticated session. Student/Teacher
// account management is gated by the `user-accounts` module, so a receptionist
// explicitly granted that module can use these shared pages like an Admin.
//
// Two operations stay Admin-only regardless of module grants:
//  - PATCH /:id/password  -> password resets are never available to a
//    receptionist (and receptionist role accounts are rejected for non-Admin
//    performers inside the service, which also protects receptionist records
//    from other receptionists who hold the module grant).
router.use(protect);

router.get('/available/:role', requireModuleAccess('user-accounts', 'all-accounts'), validateRoleParam, getAvailableProfiles);

router.get('/', requireModuleAccess('user-accounts', 'all-accounts'), getAllAccounts);

router.post('/', requireModuleAccess('user-accounts', 'create-account'), validateCreateAccount, createAccount);

router.get('/:id', requireModuleAccess('user-accounts', 'all-accounts'), validateObjectId, getAccountById);

router.put('/:id', requireModuleAccess('user-accounts', 'account-access'), validateObjectId, validateUpdateAccount, updateAccount);

router.patch('/:id/status', requireModuleAccess('user-accounts', 'account-access'), validateObjectId, validateStatusUpdate, updateAccountStatus);

router.patch('/:id/password', authorize('admin'), validateObjectId, validatePasswordUpdate, updatePassword);

router.delete('/:id', requireModuleAccess('user-accounts', 'account-access'), validateObjectId, deleteAccount);

export default router;