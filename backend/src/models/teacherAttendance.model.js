import mongoose from 'mongoose';

const ACADEMIC_YEAR_REGEX = /^(202[5-9]|203[0-5])$/;

const teacherAttendanceSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      index: true,
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

teacherAttendanceSchema.index({ teacher: 1, date: 1 }, { unique: true });
teacherAttendanceSchema.index({ date: 1 });
teacherAttendanceSchema.index({ academicYear: 1, date: 1 });
teacherAttendanceSchema.index({ status: 1 });

const TeacherAttendance = mongoose.model('TeacherAttendance', teacherAttendanceSchema);

export default TeacherAttendance;
