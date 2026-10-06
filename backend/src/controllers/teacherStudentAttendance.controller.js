import { asyncHandler } from '../utils/asyncHandler.js';
import teacherStudentAttendanceService from '../services/teacherStudentAttendance.service.js';

// Teacher Portal — Manual Student Attendance (setting-gated, timetable-derived class).
const getResponsibleClass = asyncHandler(async (req, res) => {
  const result = await teacherStudentAttendanceService.getResponsibleClass(req.user, req.query);

  return res.status(200).json({
    success: true,
    message: 'Responsible class derived from your timetable',
    data: result,
  });
});

const getClassStudents = asyncHandler(async (req, res) => {
  const result = await teacherStudentAttendanceService.getClassStudents(req.user, req.query);

  return res.status(200).json({
    success: true,
    message: 'Students fetched successfully',
    data: result,
  });
});

const saveStudentAttendance = asyncHandler(async (req, res) => {
  const result = await teacherStudentAttendanceService.saveStudentAttendance(req.user, req.body, req.user._id);

  return res.status(201).json({
    success: true,
    message: 'Student attendance saved successfully',
    data: result,
  });
});

export {
  getResponsibleClass,
  getClassStudents,
  saveStudentAttendance,
};