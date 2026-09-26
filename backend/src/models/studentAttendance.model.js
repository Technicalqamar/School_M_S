import mongoose from 'mongoose';

const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;

const studentAttendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    class: {
      type: String,
      required: [true, 'Class is required'],
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
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
    },
    status: {
      type: String,
      required: [true, 'Attendance status is required'],
      enum: {
        values: ['Present', 'Absent', 'Leave', 'Late'],
        message: '{VALUE} is not a valid attendance status',
      },
    },
    method: {
      type: String,
      enum: {
        values: ['Manual', 'QR'],
        message: '{VALUE} is not a valid attendance method',
      },
      default: 'Manual',
    },
    checkIn: {
      type: Date,
    },
    checkOut: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  },
);

studentAttendanceSchema.index({ student: 1, date: 1 }, { unique: true });
studentAttendanceSchema.index({ date: 1 });
studentAttendanceSchema.index({ class: 1, date: 1 });
studentAttendanceSchema.index({ academicYear: 1, date: 1 });
studentAttendanceSchema.index({ status: 1 });

const StudentAttendance = mongoose.model('StudentAttendance', studentAttendanceSchema);

export default StudentAttendance;
