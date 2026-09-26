import Admin from '../models/admin.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import UserAccount from '../models/userAccount.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import EmailChangeRequest from '../models/emailChangeRequest.model.js';
import PasswordChangeRequest from '../models/passwordChangeRequest.model.js';
import { ApiError } from '../utils/apiError.js';
import { sendOtpEmail, sendEmailChangeOtp, sendPasswordChangeOtp } from '../utils/email.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const timing = process.env.NODE_ENV !== 'production';

const OTP_VALIDITY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_MAX_REQUESTS = 3;
const OTP_REQUEST_WINDOW_MINUTES = 10;

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

const generateRefreshTokenValue = () => {
  return crypto.randomBytes(40).toString('hex');
};

const createRefreshToken = async (userId) => {
  const token = generateRefreshTokenValue();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({ token, user: userId, expiresAt });

  return token;
};

const verifyRefreshToken = async (token) => {
  const stored = await RefreshToken.findOne({ token, revoked: false });
  if (!stored) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  if (stored.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token expired');
  }
  return stored;
};

const revokeRefreshToken = async (token) => {
  await RefreshToken.updateOne({ token }, { revoked: true });
};

const rotateRefreshToken = async (oldToken) => {
  const stored = await verifyRefreshToken(oldToken);
  const newToken = generateRefreshTokenValue();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({ token: newToken, user: stored.user, expiresAt });
  await RefreshToken.updateOne({ _id: stored._id }, { revoked: true, replacedBy: newToken });

  return newToken;
};

const buildUserResponse = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  teacherId: user.teacherId || undefined,
  studentId: user.studentId || undefined,
});

const userAccountLogin = async (loginId, password) => {
  const account = await UserAccount.findOne({ loginId }).select('+password');
  if (!account) {
    return null;
  }

  if (!(await account.comparePassword(password))) {
    throw new ApiError(401, 'Incorrect password');
  }

  if (!account.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact the administration.');
  }

  const profileModel = account.role === 'student' ? Student : Teacher;
  const profile = await profileModel.findById(account.referenceId);

  if (!profile) {
    throw new ApiError(403, 'Linked profile not found. Contact the administration.');
  }

  if (profile.status !== 'Active') {
    throw new ApiError(403, 'Your profile is inactive. Contact the administration.');
  }

  account.lastLogin = new Date();
  await account.save();

  const accessToken = generateAccessToken(account._id);
  const refreshToken = await createRefreshToken(account._id);

  return {
    user: {
      id: account._id,
      fullName: account.fullName || profile.fullName,
      loginId: account.loginId,
      role: account.role,
      isActive: account.isActive,
      lastLogin: account.lastLogin,
      teacherId: account.role === 'teacher' ? (profile.teacherId || account.loginId) : undefined,
      studentId: account.role === 'student' ? (profile.studentId || account.loginId) : undefined,
      profile: profile || null,
    },
    accessToken,
    refreshToken,
  };
};

const adminLogin = async (email, password) => {
  const admin = await Admin.findOne({ email, role: 'admin' }).select('+password');
  if (!admin) {
    throw new ApiError(401, 'Email not found');
  }
  if (!(await admin.comparePassword(password))) {
    throw new ApiError(401, 'Incorrect password');
  }

  admin.lastLogin = new Date();
  await admin.save();

  const accessToken = generateAccessToken(admin._id);
  const refreshToken = await createRefreshToken(admin._id);
  const loggedInAdmin = await Admin.findById(admin._id);

  return { user: buildUserResponse(loggedInAdmin), accessToken, refreshToken };
};

const teacherLogin = async (teacherId, password) => {
  const portal = await userAccountLogin(teacherId, password);
  if (portal) {
    portal.user.role = 'teacher';
    return portal;
  }

  const user = await Admin.findOne({ loginId: teacherId, role: 'teacher' }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Teacher ID not found');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact the administration.');
  }
  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, 'Incorrect password');
  }

  user.lastLogin = new Date();
  await user.save();

  const accessToken = generateAccessToken(user._id);
  const refreshToken = await createRefreshToken(user._id);
  const loggedInUser = await Admin.findById(user._id);

  return { user: buildUserResponse(loggedInUser), accessToken, refreshToken };
};

const studentLogin = async (studentId, password) => {
  const portal = await userAccountLogin(studentId, password);
  if (portal) {
    portal.user.role = 'student';
    return portal;
  }

  const user = await Admin.findOne({ loginId: studentId, role: 'student' }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Student ID not found');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact the administration.');
  }
  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, 'Incorrect password');
  }

  const student = user.referenceId ? await Student.findById(user.referenceId) : null;

  const accessToken = generateAccessToken(user._id);
  const refreshToken = await createRefreshToken(user._id);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      loginId: user.loginId,
      role: 'student',
      studentId: student ? student.studentId : user.loginId,
      student: student || null,
    },
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (email) => {
  if (timing) console.time('forgotPassword');
  try {
    const admin = await Admin.findOne({ email, role: 'admin' });
    if (!admin) {
      throw new ApiError(404, 'Admin with this email does not exist');
    }

    if (admin.otpExpiry && admin.otpExpiry > new Date() && !admin.isOtpVerified) {
      const remainingMs = admin.otpExpiry.getTime() - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new ApiError(
        429,
        `Please wait until the 5-minute OTP timer ends before requesting a new OTP. (${remainingSec}s remaining)`
      );
    }

    const windowStart = new Date(Date.now() - OTP_REQUEST_WINDOW_MINUTES * 60 * 1000);
    const recentRequests = (admin.otpRequestedAt || []).filter((t) => t > windowStart);
    if (recentRequests.length >= OTP_MAX_REQUESTS) {
      throw new ApiError(429, 'Too many OTP requests. Please try again later.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

    admin.otp = await bcrypt.hash(otp, 10);
    admin.otpExpiry = otpExpiry;
    admin.isOtpVerified = false;
    admin.otpAttempts = 0;
    admin.otpRequestedAt = [...(recentRequests.length > 0 ? recentRequests : []), new Date()];
    await admin.save();

    sendOtpEmail(email, otp).catch((err) => console.error('ForgotPassword:email send failed', err));

    return { otpExpiry: otpExpiry.getTime() };
  } finally {
    if (timing) console.timeEnd('forgotPassword');
  }
};

const verifyOtp = async (email, otp) => {
  const admin = await Admin.findOne({ email, role: 'admin' });
  if (!admin) {
    throw new ApiError(404, 'Admin with this email does not exist');
  }

  if (admin.isOtpVerified) {
    return true;
  }

  if (!admin.otp || !admin.otpExpiry) {
    throw new ApiError(400, 'No OTP requested. Please request a new one.');
  }

  if (admin.otpExpiry < new Date()) {
    await Admin.updateOne(
      { _id: admin._id },
      { $set: { otp: null, otpExpiry: null, otpAttempts: 0, otpRequestedAt: [] } }
    );
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  if (admin.otpAttempts >= OTP_MAX_ATTEMPTS) {
    await Admin.updateOne(
      { _id: admin._id },
      { $set: { otp: null, otpExpiry: null, otpAttempts: 0, otpRequestedAt: [] } }
    );
    throw new ApiError(429, 'Too many failed attempts. Please request a new OTP.');
  }

  const isMatch = await bcrypt.compare(otp, admin.otp);
  if (!isMatch) {
    await Admin.updateOne({ _id: admin._id }, { $inc: { otpAttempts: 1 } });
    throw new ApiError(400, 'Invalid OTP');
  }

  await Admin.updateOne(
    { _id: admin._id },
    { $set: { isOtpVerified: true, otpAttempts: 0 } }
  );

  return true;
};

const resetPassword = async (email, newPassword) => {
  const admin = await Admin.findOne({ email, role: 'admin' });
  if (!admin) {
    throw new ApiError(404, 'Admin with this email does not exist');
  }

  if (!admin.isOtpVerified) {
    throw new ApiError(400, 'OTP not verified. Please verify your OTP first.');
  }

  admin.password = newPassword;
  admin.otp = null;
  admin.otpExpiry = null;
  admin.isOtpVerified = false;
  admin.otpAttempts = 0;
  admin.otpRequestedAt = [];
  await admin.save();

  return true;
};

const updatePassword = async (userId, currentPassword, newPassword) => {
  const admin = await Admin.findById(userId).select('+password');
  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  if (!(await admin.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  admin.password = newPassword;
  await admin.save();

  return true;
};

const verifyEmailPassword = async (userId, currentPassword) => {
  const admin = await Admin.findById(userId).select('+password');
  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  if (!(await admin.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  return true;
};

const sendEmailChangeOtpService = async (userId, newEmail, meta = {}) => {
  if (timing) console.time('sendEmailChangeOtp');
  try {
    const [admin, existingAdmin, existingRequest] = await Promise.all([
      Admin.findById(userId),
      Admin.findOne({ email: newEmail, _id: { $ne: userId } }),
      EmailChangeRequest.findOne({
        user: userId,
        status: { $in: ['PENDING', 'OTP_PENDING'] },
        otpExpiry: { $gt: new Date() },
      }),
    ]);

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (existingAdmin) {
      throw new ApiError(400, 'Email is already in use by another account');
    }

    if (existingRequest) {
      const remainingMs = existingRequest.otpExpiry.getTime() - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new ApiError(
        429,
        `An active OTP already exists. Please wait ${remainingSec}s before requesting a new one.`
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

    const [hashedOtp] = await Promise.all([
      bcrypt.hash(otp, 10),
      EmailChangeRequest.updateMany(
        { user: userId, status: { $in: ['PENDING', 'OTP_PENDING', 'VERIFIED'] } },
        { $set: { status: 'FAILED', step: 'OTP_FAILED', reason: 'Replaced by new request' } }
      ),
    ]);

    await EmailChangeRequest.create({
      user: userId,
      oldEmail: admin.email,
      newEmail,
      otp: hashedOtp,
      otpExpiry,
      attempts: 0,
      status: 'OTP_PENDING',
      step: 'OTP_SENT',
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
    });

    sendEmailChangeOtp(newEmail, otp).catch((err) => console.error('sendEmailChangeOtp:email send failed', err));

    return { otpExpiry: otpExpiry.getTime() };
  } finally {
    if (timing) console.timeEnd('sendEmailChangeOtp');
  }
};

const verifyEmailChangeOtpService = async (userId, otp, meta = {}) => {
  const request = await EmailChangeRequest.findOne({
    user: userId,
    status: { $in: ['PENDING', 'OTP_PENDING'] },
  });

  if (!request) {
    throw new ApiError(400, 'No email change request found. Please start over.');
  }

  if (request.verified) {
    return true;
  }

  if (!request.otp || !request.otpExpiry) {
    request.status = 'FAILED';
    request.step = 'OTP_FAILED';
    request.reason = 'No OTP or expiry found';
    await request.save();
    throw new ApiError(400, 'No OTP requested. Please request a new one.');
  }

  if (request.otpExpiry < new Date()) {
    request.status = 'FAILED';
    request.step = 'OTP_FAILED';
    request.reason = 'OTP expired';
    request.attempts += 1;
    await request.save();
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  if (request.attempts >= OTP_MAX_ATTEMPTS) {
    request.status = 'FAILED';
    request.step = 'OTP_FAILED';
    request.reason = 'Max attempts exceeded';
    await request.save();
    throw new ApiError(429, 'Too many failed attempts. Please request a new OTP.');
  }

  const isMatch = await bcrypt.compare(otp, request.otp);
  if (!isMatch) {
    request.attempts += 1;
    await request.save();
    throw new ApiError(400, 'Invalid OTP');
  }

  request.verified = true;
  request.status = 'SUCCESS';
  request.step = 'COMPLETED';
  request.verifiedAt = new Date();
  request.completedAt = new Date();
  request.ipAddress = meta.ipAddress || request.ipAddress;
  request.userAgent = meta.userAgent || request.userAgent;

  const admin = await Admin.findById(userId);
  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  admin.email = request.newEmail;
  await Promise.all([admin.save(), request.save()]);

  return true;
};

const initiatePasswordChange = async (userId, currentPassword, meta = {}) => {
  if (timing) console.time('initiatePasswordChange');
  try {
    const [admin, existingRequest] = await Promise.all([
      Admin.findById(userId).select('+password'),
      PasswordChangeRequest.findOne({
        user: userId,
        status: { $in: ['PENDING', 'OTP_PENDING'] },
        otpExpiry: { $gt: new Date() },
      }),
    ]);

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (!(await admin.comparePassword(currentPassword))) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    if (existingRequest) {
      const remainingMs = existingRequest.otpExpiry.getTime() - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new ApiError(
        429,
        `An active OTP already exists. Please wait ${remainingSec}s before requesting a new one.`
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

    const [hashedOtp] = await Promise.all([
      bcrypt.hash(otp, 10),
      PasswordChangeRequest.updateMany(
        { user: userId, status: { $in: ['PENDING', 'OTP_PENDING', 'VERIFIED'] } },
        { $set: { status: 'FAILED', step: 'OTP_FAILED', reason: 'Replaced by new request' } }
      ),
    ]);

    await PasswordChangeRequest.create({
      user: userId,
      email: admin.email,
      passwordVerified: true,
      otp: hashedOtp,
      otpExpiry,
      attempts: 0,
      status: 'OTP_PENDING',
      step: 'OTP_SENT',
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
    });

    sendPasswordChangeOtp(admin.email, otp).catch((err) => console.error('initiatePasswordChange:email send failed', err));

    return { otpExpiry: otpExpiry.getTime() };
  } finally {
    if (timing) console.timeEnd('initiatePasswordChange');
  }
};

const verifyPasswordChangeOtpService = async (userId, otp, meta = {}) => {
  const request = await PasswordChangeRequest.findOne({
    user: userId,
    status: { $in: ['PENDING', 'OTP_PENDING'] },
  });

  if (!request) {
    throw new ApiError(400, 'No password change request found. Please start over.');
  }

  if (request.verified) {
    return true;
  }

  if (!request.otp || !request.otpExpiry) {
    request.status = 'FAILED';
    request.step = 'OTP_FAILED';
    request.reason = 'No OTP or expiry found';
    await request.save();
    throw new ApiError(400, 'No OTP requested. Please request a new one.');
  }

  if (request.otpExpiry < new Date()) {
    request.status = 'FAILED';
    request.step = 'OTP_FAILED';
    request.reason = 'OTP expired';
    request.attempts += 1;
    await request.save();
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  if (request.attempts >= OTP_MAX_ATTEMPTS) {
    request.status = 'FAILED';
    request.step = 'OTP_FAILED';
    request.reason = 'Max attempts exceeded';
    await request.save();
    throw new ApiError(429, 'Too many failed attempts. Please request a new OTP.');
  }

  const isMatch = await bcrypt.compare(otp, request.otp);
  if (!isMatch) {
    request.attempts += 1;
    await request.save();
    throw new ApiError(400, 'Invalid OTP');
  }

  request.verified = true;
  request.status = 'VERIFIED';
  request.step = 'OTP_VERIFIED';
  request.verifiedAt = new Date();
  request.ipAddress = meta.ipAddress || request.ipAddress;
  request.userAgent = meta.userAgent || request.userAgent;
  await request.save();

  return true;
};

const completePasswordChange = async (userId, newPassword, meta = {}) => {
  const request = await PasswordChangeRequest.findOne({
    user: userId,
    status: 'VERIFIED',
    step: 'OTP_VERIFIED',
  });

  if (!request) {
    throw new ApiError(400, 'OTP not verified. Please verify your OTP first.');
  }

  const admin = await Admin.findById(userId).select('+password');
  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  admin.password = newPassword;
  request.status = 'SUCCESS';
  request.step = 'COMPLETED';
  request.completedAt = new Date();
  request.ipAddress = meta.ipAddress || request.ipAddress;
  request.userAgent = meta.userAgent || request.userAgent;

  await Promise.all([admin.save(), request.save()]);

  return true;
};

const logoutUser = async (reqUser) => {
  if (!reqUser) return;

  const isPortalUser = reqUser.role === 'student' || reqUser.role === 'teacher';
  if (!isPortalUser) return;

  try {
    const account = await UserAccount.findById(reqUser._id);
    if (!account) return;

    account.lastLogout = new Date();
    await account.save();
  } catch {
    // Logout should not fail if lastLogout persistence errors
  }
};

export default {
  adminLogin,
  teacherLogin,
  studentLogin,
  userAccountLogin,
  logoutUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  updatePassword,
  verifyEmailPassword,
  sendEmailChangeOtp: sendEmailChangeOtpService,
  verifyEmailChangeOtp: verifyEmailChangeOtpService,
  initiatePasswordChange,
  verifyPasswordChangeOtp: verifyPasswordChangeOtpService,
  completePasswordChange,
  verifyRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  generateAccessToken,
};
