import mongoose from 'mongoose';

const TIMESLOT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const periodSchema = new mongoose.Schema({
  periodNo: {
    type: Number,
    required: [true, 'Period number is required'],
    min: [1, 'Period number must be at least 1'],
  },
  type: {
    type: String,
    required: [true, 'Period type is required'],
    enum: {
      values: ['teaching', 'break'],
      message: 'Period type must be either teaching or break',
    },
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    validate: {
      validator: (v) => TIMESLOT_REGEX.test(v),
      message: 'Start time must be in HH:mm format',
    },
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    validate: {
      validator: (v) => TIMESLOT_REGEX.test(v),
      message: 'End time must be in HH:mm format',
    },
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null,
  },
});

const timetableSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    periods: {
      type: [periodSchema],
      required: [true, 'At least one period is required'],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'Timetable must have at least one period',
      },
    },
    periodStartTime: {
      type: String,
      default: '',
      validate: {
        validator: (v) => !v || TIMESLOT_REGEX.test(v),
        message: 'Period start time must be in HH:mm format',
      },
    },
    periodEndTime: {
      type: String,
      default: '',
      validate: {
        validator: (v) => !v || TIMESLOT_REGEX.test(v),
        message: 'Period end time must be in HH:mm format',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  },
);

timetableSchema.index({ academicYear: 1, classId: 1 }, { unique: true });

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
