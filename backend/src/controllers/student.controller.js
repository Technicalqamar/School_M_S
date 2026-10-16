import { asyncHandler } from '../utils/asyncHandler.js';
import studentService from '../services/student.service.js';

const createStudent = asyncHandler(async (req, res) => {
  const result = await studentService.createStudent(req.body, req.file, '', req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Student created successfully',
    student: result.student,
    ...(result.temporaryCredentials
      ? { temporaryCredentials: result.temporaryCredentials }
      : {}),
  });
});

const getAllStudents = asyncHandler(async (req, res) => {
  const result = await studentService.getAllStudents(req.query);
  const students = result.students.map((s) => s.toObject());

  return res.status(200).json({
    success: true,
    message: 'Students fetched successfully',
    data: {
      students,
      pagination: {
        totalStudents: result.totalStudents,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getStudentById = asyncHandler(async (req, res) => {
  const student = await studentService.getStudentById(req.params.studentId);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Student fetched successfully',
    data: { student },
  });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentService.updateStudent(req.params.studentId, req.body, req.file);

  return res.status(200).json({
    success: true,
    message: 'Student updated successfully',
    data: { student },
  });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await studentService.deleteStudent(req.params.studentId, req.user._id);

  return res.status(200).json({
    success: true,
    message: 'Student deleted successfully',
    data: {
      studentId: student.studentId,
    },
  });
});

// Sends a single in-app notice/reminder to the selected student's portal inbox.
// The recipient is resolved server-side from the route's studentId; the request
// body only carries the message details.
const sendStudentNotice = asyncHandler(async (req, res) => {
  const result = await studentService.sendStudentNotice(req.params.studentId, req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Notice sent to the student portal successfully',
    data: {
      notification: result.notification,
      created: result.created,
      recipient: result.recipient,
    },
  });
});

const getStudentNoticeRecipient = asyncHandler(async (req, res) => {
  const result = await studentService.getStudentNoticeRecipient(req.params.studentId);

  return res.status(200).json({
    success: true,
    message: 'Student notice recipient resolved',
    data: { recipient: result },
  });
});

export {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  sendStudentNotice,
  getStudentNoticeRecipient,
};
