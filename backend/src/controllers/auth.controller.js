import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import authService from '../services/auth.service.js';
import Student from '../models/student.model.js';
import Admin from '../models/admin.model.js';

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const result = await authService.adminLogin(email, password);

  return res.status(200).json({
    success: true,
    message: 'Admin login successful',
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  });
});

const teacherLogin = asyncHandler(async (req, res) => {
  const { teacherId, password } = req.body;
  if (!teacherId || !password) {
    throw new ApiError(400, 'Teacher ID and password are required');
  }

  const result = await authService.teacherLogin(teacherId, password);

  return res.status(200).json({
    success: true,
    message: 'Teacher login successful',
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  });
});

const studentLogin = asyncHandler(async (req, res) => {
  const { studentId, password } = req.body;
  if (!studentId || !password) {
    throw new ApiError(400, 'Student ID and password are required');
  }

  const result = await authService.studentLogin(studentId, password);

  return res.status(200).json({
    success: true,
    message: 'Student login successful',
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  });
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) {
    throw new ApiError(400, 'Refresh token is required');
  }

  const stored = await authService.verifyRefreshToken(token);
  const newAccessToken = authService.generateAccessToken(stored.user);
  const newRefreshToken = await authService.rotateRefreshToken(token);

  return res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (token) {
    await authService.revokeRefreshToken(token);
  }

  await authService.logoutUser(req.user);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = req.user;

  let studentData = null;
  if (user.role === 'student' && user.referenceId) {
    studentData = await Student.findById(user.referenceId);
  }

  let accessInfo;
  if (req.accessType === 'admin_portal_access' && req.accessAdminId) {
    const admin = await Admin.findById(req.accessAdminId).select('fullName email');
    accessInfo = {
      type: 'admin_portal_access',
      admin: admin
        ? { id: admin._id, fullName: admin.fullName, email: admin.email }
        : null,
    };
  }

  return res.status(200).json({
    success: true,
    message: 'User profile retrieved',
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email || undefined,
      loginId: user.loginId || undefined,
      role: user.role,
      teacherId: user.teacherId || undefined,
      studentId: studentData ? studentData.studentId : (user.studentId || undefined),
      isActive: user.isActive !== undefined ? user.isActive : true,
      lastLogin: user.lastLogin || undefined,
      createdAt: user.createdAt || undefined,
      student: studentData,
      accessInfo,
    },
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const result = await authService.forgotPassword(email);

  return res.status(200).json({
    success: true,
    message: 'OTP sent to your email',
    expiresAt: result.otpExpiry,
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required');
  }

  await authService.verifyOtp(email, otp);

  return res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!email || !newPassword || !confirmPassword) {
    throw new ApiError(400, 'All fields are required');
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'Passwords do not match');
  }

  await authService.resetPassword(email, newPassword);

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully',
  });
});

const verifyEmailPassword = asyncHandler(async (req, res) => {
  const { currentPassword } = req.body;
  if (!currentPassword) {
    throw new ApiError(400, 'Current password is required');
  }

  await authService.verifyEmailPassword(req.user._id, currentPassword);

  return res.status(200).json({
    success: true,
    message: 'Password verified successfully',
  });
});

const sendChangeEmailOtp = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail) {
    throw new ApiError(400, 'New email is required');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  const result = await authService.sendEmailChangeOtp(req.user._id, newEmail, meta);

  return res.status(200).json({
    success: true,
    message: 'OTP sent to your new email',
    expiresAt: result.otpExpiry,
  });
});

const verifyChangeEmailOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    throw new ApiError(400, 'OTP is required');
  }

  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  await authService.verifyEmailChangeOtp(req.user._id, otp, meta);

  return res.status(200).json({
    success: true,
    message: 'Email updated successfully',
  });
});

const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  await authService.updatePassword(req.user._id, currentPassword, newPassword);

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});

const initiatePasswordChange = asyncHandler(async (req, res) => {
  const { currentPassword } = req.body;
  if (!currentPassword) {
    throw new ApiError(400, 'Current password is required');
  }

  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  const result = await authService.initiatePasswordChange(req.user._id, currentPassword, meta);

  return res.status(200).json({
    success: true,
    message: 'OTP sent to your registered email',
    expiresAt: result.otpExpiry,
  });
});

const verifyPasswordChangeOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    throw new ApiError(400, 'OTP is required');
  }

  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  await authService.verifyPasswordChangeOtp(req.user._id, otp, meta);

  return res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
  });
});

const completePasswordChange = asyncHandler(async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) {
    throw new ApiError(400, 'New password and confirm password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'Passwords do not match');
  }

  const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  await authService.completePasswordChange(req.user._id, newPassword, meta);

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});

export {
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
};
