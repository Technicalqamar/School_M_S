import mongoose from 'mongoose';

const VALID_CLASS_NAMES = [
  'Montessori',
  'Nursery',
  'KG 1',
  'KG 2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
];

const EXAM_TYPES = ['Mid Term', 'Final Term'];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Exam name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Exam type is required'],
      enum: {
        values: EXAM_TYPES,
        message: '{VALUE} is not a valid exam type',
      },
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator(value) {
          return ACADEMIC_YEAR_REGEX.test(value);
        },
        message: 'Academic year must be a valid year (e.g. 2025)',
      },
    },
    classes: {
      type: [
        {
          type: String,
          enum: {
            values: VALID_CLASS_NAMES,
            message: '{VALUE} is not a valid class name',
          },
        },
      ],
      required: [true, 'At least one class is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['Active', 'Inactive'],
        message: 'Status must be either Active or Inactive',
      },
      default: 'Active',
    },
  },
  {
    timestamps: true,
  },
);

examSchema.index({ name: 1, academicYear: 1 }, { unique: true });
examSchema.index({ academicYear: 1 });
examSchema.index({ type: 1 });
examSchema.index({ status: 1 });

const Exam = mongoose.model('Exam', examSchema);

export default Exam;