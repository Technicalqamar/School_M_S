import mongoose from 'mongoose';

const HOLIDAY_TYPES = [
  'Public Holiday',
  'National Holiday',
  'Religious Holiday',
  'School Holiday',
  'Emergency Holiday',
  'Summer Vacation',
  'Winter Vacation',
  'Exam Break',
];

const HOLIDAY_STATUSES = ['Upcoming', 'Ongoing', 'Completed'];

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
      maxlength: [200, 'Holiday name cannot exceed 200 characters'],
    },
    startDate: {
      type: String,
      required: [true, 'Start date is required'],
      trim: true,
    },
    endDate: {
      type: String,
      required: [true, 'End date is required'],
      trim: true,
    },
    startDateDisplay: {
      type: String,
      trim: true,
    },
    endDateDisplay: {
      type: String,
      trim: true,
    },
    totalDays: {
      type: Number,
      min: [1, 'Total days must be at least 1'],
    },
    type: {
      type: String,
      required: [true, 'Holiday type is required'],
      enum: {
        values: HOLIDAY_TYPES,
        message: '{VALUE} is not a valid holiday type',
      },
    },
    appliesTo: {
      type: String,
      enum: {
        values: ['All', 'Students', 'Teachers', 'Parents', 'Staff'],
        message: '{VALUE} is not a valid audience',
      },
      default: 'All',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: HOLIDAY_STATUSES,
        message: '{VALUE} is not a valid holiday status',
      },
      default: 'Upcoming',
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

holidaySchema.index({ startDate: 1 });
holidaySchema.index({ endDate: 1 });
holidaySchema.index({ startDate: 1, endDate: 1 });
holidaySchema.index({ academicYear: 1, startDate: 1 });
holidaySchema.index({ status: 1 });

const Holiday = mongoose.model('Holiday', holidaySchema);

export default Holiday;
