import mongoose from 'mongoose';

const passwordChangeRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  email: { type: String, default: null },
  passwordVerified: { type: Boolean, default: false },
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDING', 'OTP_PENDING', 'VERIFIED', 'SUCCESS', 'FAILED'],
    default: 'PENDING',
  },
  step: {
    type: String,
    enum: ['PASSWORD_VERIFIED', 'OTP_SENT', 'OTP_VERIFIED', 'COMPLETED', 'OTP_FAILED', 'PASSWORD_INVALID'],
    default: 'PASSWORD_VERIFIED',
  },
  reason: { type: String, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

passwordChangeRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

const PasswordChangeRequest = mongoose.model('PasswordChangeRequest', passwordChangeRequestSchema);
export default PasswordChangeRequest;