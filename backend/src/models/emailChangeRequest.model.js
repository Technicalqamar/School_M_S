import mongoose from 'mongoose';

const emailChangeRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  oldEmail: { type: String, default: null },
  newEmail: { type: String, required: true },
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
    enum: ['OTP_SENT', 'OTP_VERIFIED', 'COMPLETED', 'OTP_FAILED'],
    default: 'OTP_SENT',
  },
  reason: { type: String, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

emailChangeRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

const EmailChangeRequest = mongoose.model('EmailChangeRequest', emailChangeRequestSchema);
export default EmailChangeRequest;