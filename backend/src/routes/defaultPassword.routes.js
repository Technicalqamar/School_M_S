import express from 'express';
import {
  getDefaultPasswords,
  updateDefaultPasswords,
} from '../controllers/defaultPassword.controller.js';
import { validateUpdateDefaultPasswords } from '../validations/defaultPassword.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Only authorized Administrators may view or change the default portal passwords.
router.use(protect, authorize('admin'));

router.get('/', getDefaultPasswords);

router.put('/', validateUpdateDefaultPasswords, updateDefaultPasswords);

export default router;
