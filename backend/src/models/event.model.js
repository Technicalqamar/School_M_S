import mongoose from 'mongoose';

const EVENT_CATEGORIES = [
  'Annual Function',
  'Sports Day',
  'Independence Day',
  'Teachers Day',
  'Parents Meeting',
  'Science Exhibition',
  'Seminar',
  'Workshop',
  'Competition',
  'Examination',
  'Orientation',
  'Cultural Program',
  'Other',
];

const EVENT_STATUSES = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];

const AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];

const EVENT_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: [200, 'Event name cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Event category is required'],
      enum: {
        values: EVENT_CATEGORIES,
        message: '{VALUE} is not a valid event category',
      },
    },
    date: {
      type: String,
      required: [true, 'Event date is required'],
      trim: true,
    },
    dateDisplay: {
      type: String,
      trim: true,
    },
    startTime: {
      type: String,
      trim: true,
      default: '',
    },
    endTime: {
      type: String,
      trim: true,
      default: '',
    },
    venue: {
      type: String,
      trim: true,
      default: '',
    },
    organizer: {
      type: String,
      trim: true,
      default: '',
    },
    attendanceRequired: {
      type: String,
      enum: {
        values: ['', 'Yes', 'No'],
        message: '{VALUE} is not a valid attendance requirement option',
      },
      default: '',
    },
    audience: {
      type: String,
      enum: {
        values: AUDIENCES,
        message: '{VALUE} is not a valid audience',
      },
      default: 'All',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUSES,
        message: '{VALUE} is not a valid event status',
      },
      default: 'Upcoming',
      index: true,
    },
    color: {
      type: String,
      default: EVENT_COLORS[0],
      enum: {
        values: EVENT_COLORS,
        message: '{VALUE} is not a valid event color',
      },
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      validate: {
        validator: function (v) {
          return /^\d{4}$/.test(v);
        },
        message: 'Invalid academic year format. Use a valid year (e.g. 2025)',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

eventSchema.index({ date: 1 });
eventSchema.index({ academicYear: 1, date: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1, date: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
