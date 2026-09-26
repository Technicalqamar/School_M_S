import mongoose from 'mongoose';
import Counter from './counter.model.js';

const teacherSchema = new mongoose.Schema(
  {
    teacherImage: {
      type: String,
      required: [true, 'Teacher image is required'],
    },
    teacherImagePublicId: {
      type: String,
      default: '',
    },
    teacherId: {
      type: String,
      unique: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    fatherName: {
      type: String,
      required: [true, 'Father name is required'],
      trim: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: [true, 'Gender is required'],
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    cnic: {
      type: String,
      required: [true, 'CNIC is required'],
      validate: {
        validator: function (v) {
          return /^\d{5}-\d{7}-\d{1}$/.test(v);
        },
        message: 'CNIC must be in format XXXXX-XXXXXXX-X',
      },
    },
    maritalStatus: {
      type: String,
      enum: ['Single', 'Married'],
      required: [true, 'Marital status is required'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      validate: {
        validator: function (v) {
          return /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/.test(v);
        },
        message: 'Please provide a valid Pakistani mobile number',
      },
    },
    alternatePhoneNumber: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^(\+92|0)3[0-9]{2}[-\s]?[0-9]{7}$/.test(v);
        },
        message: 'Please provide a valid Pakistani mobile number',
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
      trim: true,
    },
    experience: {
      type: String,
      required: [true, 'Experience is required'],
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    assignedSubjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
  },
  {
    timestamps: true,
  },
);

teacherSchema.index({ phoneNumber: 1 });
teacherSchema.index({ status: 1 });
teacherSchema.index({ cnic: 1 });

teacherSchema.pre('save', async function () {
  if (this.isNew && !this.teacherId) {
    const seq = await Counter.increment('teacherId');
    this.teacherId = `TCH-${String(seq).padStart(6, '0')}`;
  }
});

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;
