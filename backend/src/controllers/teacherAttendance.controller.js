import { asyncHandler } from '../utils/asyncHandler.js';
import teacherAttendanceService from '../services/teacherAttendance.service.js';
import studentAttendanceService from '../services/studentAttendance.service.js';

const getTeachersWithAttendance = asyncHandler(async (req, res) => {
  const { academicYear, date } = req.query;
  const result = await teacherAttendanceService.getTeachersWithAttendance(academicYear, date);

  return res.status(200).json({
    success: true,
    message: 'Teachers fetched successfully',
    data: result,
  });
});

const saveAttendance = asyncHandler(async (req, res) => {
  const result = await teacherAttendanceService.saveAttendance(req.body, req.user._id);

  return res.status(201).json({
    success: true,
    message: 'Teacher attendance saved successfully',
    data: result,
  });
});

const qrScanTeacherAttendance = asyncHandler(async (req, res) => {
  const result = await teacherAttendanceService.qrScanTeacherAttendance(req.body, req.user._id);

  const isCheckout = result.action === 'checkout';

  return res.status(isCheckout ? 200 : 201).json({
    success: true,
    message: isCheckout
      ? `Teacher checked out via QR scan for ${result.teacher.fullName}`
      : `Teacher attendance marked as ${result.status} via QR scan for ${result.teacher.fullName}`,
    data: result,
  });
});

const getAttendanceByDate = asyncHandler(async (req, res) => {
  const { date, academicYear } = req.query;
  const records = await teacherAttendanceService.getAttendanceByDate(date, academicYear);

  return res.status(200).json({
    success: true,
    message: 'Teacher attendance records fetched successfully',
    data: { records },
  });
});

const getAttendanceByTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const { academicYear } = req.query;
  const records = await teacherAttendanceService.getAttendanceByTeacher(teacherId, academicYear);

  return res.status(200).json({
    success: true,
    message: 'Teacher attendance fetched successfully',
    data: { records },
  });
});

const getAttendanceHistory = asyncHandler(async (req, res) => {
  const { type } = req.query || {};
  // `type` selects the attendance collection: Student (default) or Teacher.
  const result = type === 'Student'
    ? await studentAttendanceService.getAttendanceHistory(req.query)
    : await teacherAttendanceService.getAttendanceHistory(req.query);

  return res.status(200).json({
    success: true,
    message: type === 'Student' ? 'Student attendance history fetched successfully' : 'Teacher attendance history fetched successfully',
    data: result,
  });
});

const getAttendanceReports = asyncHandler(async (req, res) => {
  const result = await teacherAttendanceService.getAttendanceReports(req.query);

  return res.status(200).json({
    success: true,
    message: 'Teacher attendance reports fetched successfully',
    data: result,
  });
});

const deleteAttendance = asyncHandler(async (req, res) => {
  await teacherAttendanceService.deleteAttendance(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Teacher attendance record deleted successfully',
  });
});

const resetCheckIn = asyncHandler(async (req, res) => {
  const { teacherId, date, academicYear, checkIn } = req.body;

  if (!teacherId || !date) {
    return res.status(400).json({
      success: false,
      message: 'Teacher ID and date are required',
    });
  }

  const result = await teacherAttendanceService.resetCheckIn(teacherId, date, academicYear, checkIn);

  return res.status(200).json({
    success: true,
    message: checkIn ? 'Check-in time updated successfully' : 'Check-in time cleared successfully',
    data: result,
  });
});

export {
  getTeachersWithAttendance,
  saveAttendance,
  qrScanTeacherAttendance,
  getAttendanceByDate,
  getAttendanceByTeacher,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  resetCheckIn,
};
