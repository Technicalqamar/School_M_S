import mongoose from 'mongoose';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const classSchema = new mongoose.Schema(
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
    assignedSubjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
  },
  {
    timestamps: true,
  },
);

classSchema.index({ className: 1, academicYear: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

export default Class;
