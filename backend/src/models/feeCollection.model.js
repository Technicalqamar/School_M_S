import mongoose from 'mongoose';

const VALID_FEE_TYPES = ['Admission', 'Monthly', 'Examination'];

const VALID_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Online Payment', 'Voucher'];

const feeCollectionSchema = new mongoose.Schema(
  {
    receiptId: {
      type: String,
      required: [true, 'Receipt ID is required'],
      unique: true,
      trim: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      trim: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    fatherName: {
      type: String,
      required: [true, 'Father name is required'],
      trim: true,
    },
    className: {
      type: String,
      required: [true, 'Class is required'],
      trim: true,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
    feeType: {
      type: String,
      required: [true, 'Fee type is required'],
      enum: {
        values: VALID_FEE_TYPES,
        message: '{VALUE} is not a valid fee type',
      },
    },
    month: {
      type: String,
      required: [true, 'Month is required'],
      trim: true,
    },
    exam: {
      type: String,
      default: null,
      trim: true,
    },
    baseAmount: {
      type: Number,
      required: [true, 'Base amount is required'],
      min: [0, 'Base amount cannot be negative'],
    },
    discount: {
      type: Number,
      required: [true, 'Discount is required'],
      min: [0, 'Discount cannot be negative'],
      default: 0,
    },
    lateFine: {
      type: Number,
      required: [true, 'Late fine is required'],
      min: [0, 'Late fine cannot be negative'],
      default: 0,
    },
    totalPayable: {
      type: Number,
      required: [true, 'Total payable is required'],
      min: [0, 'Total payable cannot be negative'],
    },
    amountPaid: {
      type: Number,
      required: [true, 'Amount paid is required'],
      min: [0, 'Amount paid cannot be negative'],
    },
    remainingAmount: {
      type: Number,
      required: [true, 'Remaining amount is required'],
      min: [0, 'Remaining amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: VALID_PAYMENT_METHODS,
        message: '{VALUE} is not a valid payment method',
      },
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    // Voucher metadata (reuses the existing fee records collection; payment records leave these null)
    voucherId: {
      type: String,
      default: null,
      trim: true,
    },
    classId: {
      type: String,
      default: null,
      trim: true,
    },
    issueDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    currentFee: {
      type: Number,
      default: null,
      min: [0, 'Current fee cannot be negative'],
    },
    previousOutstanding: {
      type: Number,
      default: null,
      min: [0, 'Previous outstanding cannot be negative'],
    },
    voucherStatus: {
      type: String,
      default: null,
      enum: {
        values: ['Generated', 'Cancelled'],
        message: '{VALUE} is not a valid voucher status',
      },
    },
    generatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

feeCollectionSchema.index({ student: 1, academicYear: 1, feeType: 1, month: 1 });
feeCollectionSchema.index({ voucherId: 1 }, { unique: true, partialFilterExpression: { voucherId: { $type: 'string' } } });
feeCollectionSchema.index({ academicYear: 1, voucherId: 1 }, { partialFilterExpression: { voucherId: { $type: 'string' } } });

const FeeCollection = mongoose.model('FeeCollection', feeCollectionSchema);

export default FeeCollection;