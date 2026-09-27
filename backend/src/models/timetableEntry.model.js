import mongoose from 'mongoose';

// Timetable Management — Create Timetable backend.
//
// One entry = one (class, time slot, subject) booking for an academic year.
// The teacher is NEVER stored manually: it is resolved from the existing
// Class Management Class → Teacher → Subject assignment at save time.
const TIMETABLE_GROUPS = [1, 2, 3];

const timetableEntrySchema = new mongoose.Schema(
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
    // Derived from the existing Class data (className → group mapping). Never
    // provided by the client — the backend always computes it from the class.
    group: {
      type: Number,
      required: [true, 'Group is required'],
      enum: {
        values: TIMETABLE_GROUPS,
        message: '{VALUE} is not a valid timetable group',
      },
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: [true, 'Time slot is required'],
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
      index: true,
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

// A class occupies each time slot exactly once per academic year. This blocks
// duplicate entries and duplicate subject entries for the same class + slot
// (Validation rules 6 & 10) at the database level.
timetableEntrySchema.index({ academicYear: 1, classId: 1, timeSlotId: 1 }, { unique: true });
timetableEntrySchema.index({ academicYear: 1, teacherId: 1 });
timetableEntrySchema.index({ academicYear: 1, group: 1 });
timetableEntrySchema.index({ classId: 1 });

const TimetableEntry = mongoose.model('TimetableEntry', timetableEntrySchema);

export default TimetableEntry;