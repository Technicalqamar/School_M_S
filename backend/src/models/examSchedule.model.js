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

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const examScheduleSchema = new mongoose.Schema(
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
          return ACADEMIC_YEAR_REGEX.test(value);
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
    examDate: {
      type: Date,
      required: [true, 'Exam date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      validate: {
        validator(value) {
          return TIME_REGEX.test(value);
        },
        message: 'Start time must be a valid time in 24-hour format (HH:MM)',
      },
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      validate: [
        {
          validator(value) {
            return TIME_REGEX.test(value);
          },
          message: 'End time must be a valid time in 24-hour format (HH:MM)',
        },
        {
          validator(value) {
            if (!this.startTime) return true;
            return value > this.startTime;
          },
          message: 'End time must be after start time',
        },
      ],
    },
    room: {
      type: String,
      required: [true, 'Room is required'],
      trim: true,
    },
    notes: {
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

examScheduleSchema.index({ examId: 1, className: 1, subjectId: 1, academicYear: 1 }, { unique: true });
examScheduleSchema.index({ examId: 1, className: 1 });
examScheduleSchema.index({ academicYear: 1 });
examScheduleSchema.index({ subjectId: 1 });
examScheduleSchema.index({ examDate: 1 });
examScheduleSchema.index({ status: 1 });

const ExamSchedule = mongoose.model('ExamSchedule', examScheduleSchema);

export default ExamSchedule;