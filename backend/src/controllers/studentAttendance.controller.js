import { asyncHandler } from '../utils/asyncHandler.js';
import studentAttendanceService from '../services/studentAttendance.service.js';
import teacherAttendanceService from '../services/teacherAttendance.service.js';

const qrScanAttendance = asyncHandler(async (req, res) => {
  const result = await studentAttendanceService.qrScanAttendance(req.body, req.user._id);

  return res.status(201).json({
    success: true,
    message: `Attendance marked as ${result.status} via QR scan for ${result.student.fullName}`,
    data: result,
  });
});

const saveAttendance = asyncHandler(async (req, res) => {
  const result = await studentAttendanceService.saveAttendance(req.body, req.user._id);

  return res.status(201).json({
    success: true,
    message: 'Attendance saved successfully',
    data: result,
  });
});

const getStudentsWithAttendance = asyncHandler(async (req, res) => {
  const { academicYear, class: className, date } = req.query;

  if (!academicYear) {
    return res.status(400).json({
      success: false,
      message: 'Academic year is required',
    });
  }

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required',
    });
  }

  const result = await studentAttendanceService.getStudentsWithAttendance(
    academicYear,
    className,
    date,
  );

  return res.status(200).json({
    success: true,
    message: 'Students fetched successfully',
    data: result,
  });
});

const getAttendanceByClass = asyncHandler(async (req, res) => {
  const { class: className, academicYear, date } = req.query;

  const records = await studentAttendanceService.getAttendanceByClass(className, academicYear, date);

  return res.status(200).json({
    success: true,
    message: 'Attendance records fetched successfully',
    data: { records },
  });
});

const getAttendanceByDate = asyncHandler(async (req, res) => {
  const { date, academicYear } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required',
    });
  }

  const records = await studentAttendanceService.getAttendanceByDate(date, academicYear);

  return res.status(200).json({
    success: true,
    message: 'Attendance records fetched successfully',
    data: { records },
  });
});

const getAttendanceByStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { academicYear } = req.query;

  const records = await studentAttendanceService.getAttendanceByStudent(studentId, academicYear);

  return res.status(200).json({
    success: true,
    message: 'Student attendance fetched successfully',
    data: { records },
  });
});

const getAttendanceHistory = asyncHandler(async (req, res) => {
  const { type } = req.query || {};
  // `type` selects the attendance collection: Student (default) or Teacher.
  const result = type === 'Teacher'
    ? await teacherAttendanceService.getAttendanceHistory(req.query)
    : await studentAttendanceService.getAttendanceHistory(req.query);

  return res.status(200).json({
    success: true,
    message: type === 'Teacher' ? 'Teacher attendance history fetched successfully' : 'Attendance history fetched successfully',
    data: result,
  });
});

const getAttendanceReports = asyncHandler(async (req, res) => {
  const result = await studentAttendanceService.getAttendanceReports(req.query);

  return res.status(200).json({
    success: true,
    message: 'Attendance reports fetched successfully',
    data: result,
  });
});

const deleteAttendance = asyncHandler(async (req, res) => {
  await studentAttendanceService.deleteAttendance(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Attendance record deleted successfully',
  });
});

const deleteBulkAttendance = asyncHandler(async (req, res) => {
  const { className, academicYear, date } = req.query;
  const result = await studentAttendanceService.deleteBulkAttendance(className, academicYear, date);

  return res.status(200).json({
    success: true,
    message: 'Attendance records deleted successfully',
    data: { deletedCount: result.deletedCount },
  });
});

const resetCheckIn = asyncHandler(async (req, res) => {
  const { studentId, date, academicYear, checkIn } = req.body;

  if (!studentId || !date) {
    return res.status(400).json({ success: false, message: 'Student ID and date are required' });
  }

  const result = await studentAttendanceService.resetCheckIn(studentId, date, academicYear, checkIn);

  return res.status(200).json({
    success: true,
    message: checkIn ? 'Check-in time updated successfully' : 'Check-in time cleared successfully',
    data: result,
  });
});

export {
  saveAttendance,
  qrScanAttendance,
  getStudentsWithAttendance,
  getAttendanceByClass,
  getAttendanceByDate,
  getAttendanceByStudent,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  deleteBulkAttendance,
  resetCheckIn,
};
