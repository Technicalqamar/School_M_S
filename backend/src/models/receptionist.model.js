import mongoose from 'mongoose';
import Counter from './counter.model.js';
import { DEFAULT_RECEPTIONIST_PERMISSIONS } from '../constants/permissions.js';

// Receptionist profile. Mirrors the Student/Teacher pattern: the profile holds
// the role-specific data (including the permission set) while the linked
// UserAccount holds the login credentials and hashed password. There is no
// public registration route for receptionists - accounts are created by an
// authenticated Admin only.
const receptionistSchema = new mongoose.Schema(
  {
    receptionistId: {
      type: String,
      unique: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    // Explicit, least-privilege permission set. Validated against the central
    // catalogue on the way in; enforced server-side on every request.
    permissions: {
      type: [String],
      default: () => [...DEFAULT_RECEPTIONIST_PERMISSIONS],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  { timestamps: true },
);

receptionistSchema.index({ status: 1 });

receptionistSchema.pre('save', async function () {
  if (this.isNew && !this.receptionistId) {
    const seq = await Counter.increment('receptionistId');
    this.receptionistId = `REC-${String(seq).padStart(6, '0')}`;
  }
});

const Receptionist = mongoose.model('Receptionist', receptionistSchema);

export default Receptionist;
