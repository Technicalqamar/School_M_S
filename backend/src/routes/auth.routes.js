import express from 'express';
import {
  adminLogin,
  teacherLogin,
  studentLogin,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyEmailPassword,
  sendChangeEmailOtp,
  verifyChangeEmailOtp,
  updatePassword,
  initiatePasswordChange,
  verifyPasswordChangeOtp,
  completePasswordChange,
} from '../controllers/auth.controller.js';
import {
  validateAdminLogin,
  validateTeacherLogin,
  validateStudentLogin,
  validateForgotPassword,
  validateVerifyOtp,
  validateResetPassword,
} from '../validations/auth.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Public routes
router.post('/admin/login', validateAdminLogin, adminLogin);
router.post('/teacher/login', validateTeacherLogin, teacherLogin);
router.post('/student/login', validateStudentLogin, studentLogin);

// Refresh token
router.post('/refresh-token', refreshToken);

// Password reset flow (admin)
router.post('/admin/forgot-password', validateForgotPassword, forgotPassword);
router.post('/admin/verify-otp', validateVerifyOtp, verifyOtp);
router.post('/admin/reset-password', validateResetPassword, resetPassword);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

// Email change flow (admin)
router.post('/email-change/verify-password', protect, authorize('admin'), verifyEmailPassword);
router.post('/email-change/send-otp', protect, authorize('admin'), sendChangeEmailOtp);
router.post('/email-change/verify-otp', protect, authorize('admin'), verifyChangeEmailOtp);

// Password change flow (admin) - OTP verified
router.post('/password-change/initiate', protect, authorize('admin'), initiatePasswordChange);
router.post('/password-change/verify-otp', protect, authorize('admin'), verifyPasswordChangeOtp);
router.patch('/password-change/complete', protect, authorize('admin'), completePasswordChange);

// Password change (legacy - direct update)
router.patch('/update-password', protect, authorize('admin'), updatePassword);

// RBAC examples (protected + role-gated)
router.get('/admin/dashboard', protect, authorize('admin'), (req, res) => {
  res.json({ success: true, message: 'Admin dashboard' });
});

router.get('/teacher/dashboard', protect, authorize('admin', 'teacher'), (req, res) => {
  res.json({ success: true, message: 'Teacher dashboard' });
});

router.get('/student/dashboard', protect, authorize('admin', 'teacher', 'student'), (req, res) => {
  res.json({ success: true, message: 'Student dashboard' });
});

export default router;
