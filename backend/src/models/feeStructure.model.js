import mongoose from 'mongoose';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const feeStructureSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: [true, 'Class name is required'],
      enum: {
        values: VALID_CLASS_NAMES,
        message: '{VALUE} is not a valid class name',
      },
      trim: true,
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
    },
    monthlyFee: {
      type: Number,
      required: [true, 'Monthly fee is required'],
      min: [0, 'Monthly fee cannot be negative'],
    },
    admissionFee: {
      type: Number,
      required: [true, 'Admission fee is required'],
      min: [0, 'Admission fee cannot be negative'],
    },
    examFee: {
      type: Number,
      required: [true, 'Exam fee is required'],
      min: [0, 'Exam fee cannot be negative'],
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['Active', 'Inactive'],
        message: 'Status must be either Active or Inactive',
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

feeStructureSchema.index({ academicYear: 1, className: 1 }, { unique: true });

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

export default FeeStructure;