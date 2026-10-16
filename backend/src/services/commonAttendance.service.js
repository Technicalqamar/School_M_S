import IdCardManagement from '../models/idCardManagement.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import studentAttendanceService from './studentAttendance.service.js';
import teacherAttendanceService from './teacherAttendance.service.js';
import { ApiError } from '../utils/apiError.js';

// The module key every QR attendance action lives under.
const ATTENDANCE_MODULE_KEY = 'attendance-management';

// A single `POST /attendance/qr-scan` endpoint accepts BOTH student and teacher
// QR codes, but the two are different operations with different permissions.
// This maps the resolved card type to the action an operator must hold, so the
// student permission is never reused for a teacher scan (and vice versa).
const QR_SCAN_ACTION_BY_TARGET_TYPE = {
  student: 'student-attendance-mark',
  teacher: 'teacher-attendance-mark',
};

const resolveQrScanAction = (targetType) =>
  QR_SCAN_ACTION_BY_TARGET_TYPE[targetType] || null;

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

// Determines which attendance domain a QR value belongs to WITHOUT recording any
// attendance, so the caller can authorize the correct action before the scan is
// executed. The lookup order mirrors `qrScanAnyAttendance` exactly (student card
// first, then teacher QR) so authorization and execution can never disagree: a
// code that would be executed as a student scan is authorized as a student scan.
const resolveQrTargetType = async (qrValue, academicYear) => {
  const trimmed = typeof qrValue === 'string' ? qrValue.trim() : '';
  if (!trimmed) return null;

  const card = await IdCardManagement.findOne({ qrValue: trimmed }).lean();
  if (card) {
    const student = await Student.findById(card.student).lean();
    if (student) return 'student';
  }

  const teacher = await teacherAttendanceService.findTeacherByQr(trimmed, academicYear);
  if (teacher) return 'teacher';

  return null;
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

export {
  ATTENDANCE_MODULE_KEY,
  QR_SCAN_ACTION_BY_TARGET_TYPE,
  resolveQrScanAction,
  resolveQrTargetType,
  qrScanAnyAttendance,
};

export default {
  ATTENDANCE_MODULE_KEY,
  QR_SCAN_ACTION_BY_TARGET_TYPE,
  resolveQrScanAction,
  resolveQrTargetType,
  qrScanAnyAttendance,
};
