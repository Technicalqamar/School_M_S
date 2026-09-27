import mongoose from 'mongoose';

const TIME_SLOT_TYPES = ['PERIOD', 'BREAK'];
const TIME_SLOT_STATUSES = ['Active', 'Inactive'];

// HH:mm (24-hour) — the same format used by the previous timetable module.
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeSlotSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      validate: {
        validator: (v) => /^\d{4}$/.test(v),
        message: 'Invalid academic year format. Use a valid year (e.g. 2025)',
      },
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
      validate: {
        validator: (v) => TIME_REGEX.test(v),
        message: 'Start time must be in HH:mm format',
      },
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
      validate: {
        validator: (v) => TIME_REGEX.test(v),
        message: 'End time must be in HH:mm format',
      },
    },
    type: {
      type: String,
      required: [true, 'Time slot type is required'],
      enum: {
        values: TIME_SLOT_TYPES,
        message: '{VALUE} is not a valid time slot type',
      },
    },
    label: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Label cannot exceed 100 characters'],
    },
    status: {
      type: String,
      enum: {
        values: TIME_SLOT_STATUSES,
        message: '{VALUE} is not a valid time slot status',
      },
      default: 'Active',
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

// Prevent duplicate/conflicting identical time slots for the same academic year.
// A time slot's identity is its time range within an academic year — two slots
// sharing (academicYear, startTime, endTime) are never allowed, regardless of type.
timeSlotSchema.index({ academicYear: 1, startTime: 1, endTime: 1 }, { unique: true });
timeSlotSchema.index({ academicYear: 1, type: 1 });
timeSlotSchema.index({ academicYear: 1, startTime: 1 });

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

export default TimeSlot;