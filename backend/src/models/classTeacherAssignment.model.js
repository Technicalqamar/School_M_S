import mongoose from 'mongoose';

const classTeacherAssignmentSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

classTeacherAssignmentSchema.index({ class: 1, teacher: 1, subject: 1 }, { unique: true });
classTeacherAssignmentSchema.index({ class: 1, subject: 1 }, { unique: true });
classTeacherAssignmentSchema.index({ teacher: 1, academicYear: 1 });
classTeacherAssignmentSchema.index({ class: 1 });

const ClassTeacherAssignment = mongoose.model('ClassTeacherAssignment', classTeacherAssignmentSchema);

export default ClassTeacherAssignment;