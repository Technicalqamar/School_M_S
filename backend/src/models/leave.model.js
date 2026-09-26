import mongoose from 'mongoose';

const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;

const leaveSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Leave type is required'],
      enum: {
        values: ['Student', 'Teacher'],
        message: '{VALUE} is not a valid leave type',
      },
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      index: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
    },
    class: {
      type: String,
      trim: true,
      default: '',
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator: function (v) {
          return ACADEMIC_YEAR_REGEX.test(v);
        },
        message: 'Academic year must be a valid year (e.g. 2025)',
      },
      index: true,
    },
    fromDate: {
      type: String,
      required: [true, 'From date is required'],
      trim: true,
      index: true,
    },
    toDate: {
      type: String,
      required: [true, 'To date is required'],
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Leave reason is required'],
      trim: true,
      maxlength: [500, 'Leave reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Approved', 'Rejected'],
        message: '{VALUE} is not a valid leave status',
      },
      default: 'Pending',
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for overlap checks and attendance lookups
leaveSchema.index({ student: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ teacher: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ type: 1, status: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ academicYear: 1, status: 1 });

const Leave = mongoose.model('Leave', leaveSchema);

export default Leave;