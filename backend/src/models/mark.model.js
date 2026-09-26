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

const markSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam is required'],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator(value) {
          return /^\d{4}$/.test(value);
        },
        message: 'Academic year must be a valid year (e.g. 2025)',
      },
    },
    className: {
      type: String,
      required: [true, 'Class is required'],
      enum: {
        values: VALID_CLASS_NAMES,
        message: '{VALUE} is not a valid class name',
      },
    },
    obtainedMarks: {
      type: Number,
      required: [true, 'Obtained marks are required'],
      min: [0, 'Obtained marks cannot be negative'],
    },
    totalMarks: {
      type: Number,
      min: [1, 'Total marks must be at least 1'],
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['Entered'],
        message: 'Invalid mark status',
      },
      default: 'Entered',
    },
  },
  {
    timestamps: true,
  },
);

markSchema.index({ examId: 1, studentId: 1, subjectId: 1 }, { unique: true });
markSchema.index({ examId: 1, subjectId: 1 });
markSchema.index({ examId: 1, className: 1 });
markSchema.index({ academicYear: 1 });
markSchema.index({ studentId: 1 });

markSchema.virtual('isPass').get(function () {
  return !this.passingMarks || this.obtainedMarks >= this.passingMarks;
});

const Mark = mongoose.model('Mark', markSchema);

export default Mark;