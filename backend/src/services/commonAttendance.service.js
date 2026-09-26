import IdCardManagement from '../models/idCardManagement.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import studentAttendanceService from './studentAttendance.service.js';
import teacherAttendanceService from './teacherAttendance.service.js';
import { ApiError } from '../utils/apiError.js';

const resolveStudentMatch = async (qrValue, academicYear, className, date, userId) => {
  const card = await IdCardManagement.findOne({ qrValue: qrValue.trim() }).lean();
  if (!card) return null;

  const student = await Student.findById(card.student).lean();
  if (!student) return null;

  const studentRecord = await studentAttendanceService.qrScanAttendance(
    { qrValue: qrValue.trim(), academicYear, className, date },
    userId,
  );

  return { type: 'student', ...studentRecord };
};

const resolveTeacherMatch = async (qrValue, academicYear, date, userId) => {
  const teacher = await teacherAttendanceService.findTeacherByQr(qrValue, academicYear);
  if (!teacher) return null;

  const teacherRecord = await teacherAttendanceService.qrScanTeacherAttendance(
    { qrValue, academicYear, date },
    userId,
  );

  return { type: 'teacher', ...teacherRecord };
};

const qrScanAnyAttendance = async (data = {}, userId) => {
  const { qrValue, academicYear, className, date } = data || {};
  const trimmedQrValue = typeof qrValue === 'string' ? qrValue.trim() : '';

  if (!trimmedQrValue) {
    throw new ApiError(400, 'QR value is required');
  }

  let studentResult = null;
  try {
    studentResult = await resolveStudentMatch(trimmedQrValue, academicYear, className, date, userId);
  } catch (error) {
    const status = error?.statusCode || error?.response?.status;
    const message = error?.message || '';

    if (status === 409 || /already marked/i.test(message)) {
      throw error;
    }

    if (status === 404 || /invalid qr|not linked|no student card|no active student|no student/i.test(message)) {
      // remain on the fallback path to teacher lookup when the QR is not a student QR
    } else {
      throw error;
    }
  }

  if (studentResult) {
    return studentResult;
  }

  let teacherResult = null;
  try {
    teacherResult = await resolveTeacherMatch(trimmedQrValue, academicYear, date, userId);
  } catch (error) {
    const status = error?.statusCode || error?.response?.status;
    const message = error?.message || '';

    if (status === 409 || /already marked/i.test(message)) {
      throw error;
    }

    if (status === 404 || /invalid teacher qr|no active teacher|teacher qr|no active teacher matches|not found/i.test(message)) {
      throw new ApiError(404, 'Unknown QR code');
    }

    throw error;
  }

  if (teacherResult) {
    return teacherResult;
  }

  throw new ApiError(404, 'Unknown QR code');
};

export default {
  qrScanAnyAttendance,
};
