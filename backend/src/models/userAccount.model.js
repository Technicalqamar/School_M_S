import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userAccountSchema = new mongoose.Schema(
  {
    loginId: {
      type: String,
      required: [true, 'Login ID is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'teacher'],
      required: [true, 'Role is required'],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Reference ID is required'],
      refPath: 'referenceModel',
    },
    referenceModel: {
      type: String,
      required: [true, 'Reference model is required'],
      enum: ['Student', 'Teacher'],
    },
    fullName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    profileImagePublicId: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastLogout: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userAccountSchema.index({ referenceId: 1, referenceModel: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
userAccountSchema.index({ role: 1 });
userAccountSchema.index({ isActive: 1 });

userAccountSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userAccountSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const UserAccount = mongoose.model('UserAccount', userAccountSchema);

export default UserAccount;
