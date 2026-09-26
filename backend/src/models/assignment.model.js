import mongoose from 'mongoose';

const VALID_ASSIGNMENT_STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];

const assignmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true,
      maxlength: [150, 'Assignment title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    status: {
      type: String,
      enum: {
        values: VALID_ASSIGNMENT_STATUSES,
        message: 'Status must be one of {VALID_ASSIGNMENT_STATUSES}',
      },
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  },
);

assignmentSchema.index({ teacherId: 1, createdAt: -1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;