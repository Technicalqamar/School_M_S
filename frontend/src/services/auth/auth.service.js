import api from '../../api/axios';

const authService = {
  adminLogin: async (email, password) => {
    const response = await api.post('/auth/admin/login', { email, password });
    return response.data;
  },

  teacherLogin: async (teacherId, password) => {
    const response = await api.post('/auth/teacher/login', { teacherId, password });
    return response.data;
  },

  studentLogin: async (studentId, password) => {
    const response = await api.post('/auth/student/login', { studentId, password });
    return response.data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  adminForgotPassword: async (email) => {
    const response = await api.post('/auth/admin/forgot-password', { email });
    return response.data;
  },

  adminVerifyOtp: async (email, otp) => {
    const response = await api.post('/auth/admin/verify-otp', { email, otp });
    return response.data;
  },

  adminResetPassword: async (email, newPassword, confirmPassword) => {
    const response = await api.post('/auth/admin/reset-password', { email, newPassword, confirmPassword });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },

  updateProfile: async (formData) => {
    const response = await api.put('/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/profile/change-password', { currentPassword, newPassword });
    return response.data;
  },

  verifyEmailPassword: async (currentPassword) => {
    const response = await api.post('/auth/email-change/verify-password', { currentPassword });
    return response.data;
  },

  sendChangeEmailOtp: async (newEmail) => {
    const response = await api.post('/auth/email-change/send-otp', { newEmail });
    return response.data;
  },

  verifyChangeEmailOtp: async (otp) => {
    const response = await api.post('/auth/email-change/verify-otp', { otp });
    return response.data;
  },

  updatePassword: async (currentPassword, newPassword) => {
    const response = await api.patch('/auth/update-password', { currentPassword, newPassword });
    return response.data;
  },

  initiatePasswordChange: async (currentPassword) => {
    const response = await api.post('/auth/password-change/initiate', { currentPassword });
    return response.data;
  },

  verifyPasswordChangeOtp: async (otp) => {
    const response = await api.post('/auth/password-change/verify-otp', { otp });
    return response.data;
  },

  completePasswordChange: async (newPassword, confirmPassword) => {
    const response = await api.patch('/auth/password-change/complete', { newPassword, confirmPassword });
    return response.data;
  },

  setSecurityLock: async (lock) => {
    const response = await api.post('/auth/security-lock/set', { lock });
    return response.data;
  },

  verifySecurityLock: async (lock) => {
    const response = await api.post('/auth/security-lock/verify', { lock });
    return response.data;
  },

  changeSecurityLock: async (oldLock, newLock) => {
    const response = await api.post('/auth/security-lock/change', { oldLock, newLock });
    return response.data;
  },
};

export default authService;
