import express from 'express';
import { getProfile, updateProfile, changePassword, removeProfileImage } from '../controllers/profile.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { createUploader } from '../middlewares/upload.middleware.js';

const router = express.Router();
const adminProfileUpload = createUploader('admin-profile');

router.get('/', protect, getProfile);
router.put('/', protect, adminProfileUpload.single('profileImage'), updateProfile);
router.delete('/image', protect, removeProfileImage);
router.put('/change-password', protect, changePassword);

export default router;
