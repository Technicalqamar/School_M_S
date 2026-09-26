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

const examSubjectSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam is required'],
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
    totalMarks: {
      type: Number,
      required: [true, 'Total marks are required'],
      min: [1, 'Total marks must be at least 1'],
    },
    passingMarks: {
      type: Number,
      required: [true, 'Passing marks are required'],
      min: [0, 'Passing marks cannot be negative'],
      validate: {
        validator(value) {
          if (this.totalMarks == null) return true;
          return value <= this.totalMarks;
        },
        message: 'Passing marks cannot exceed total marks',
      },
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

examSubjectSchema.index({ examId: 1, subjectId: 1, className: 1, academicYear: 1 }, { unique: true });
examSubjectSchema.index({ examId: 1, className: 1 });
examSubjectSchema.index({ academicYear: 1 });
examSubjectSchema.index({ subjectId: 1 });
examSubjectSchema.index({ status: 1 });

const ExamSubject = mongoose.model('ExamSubject', examSubjectSchema);

export default ExamSubject;