import { asyncHandler } from '../utils/asyncHandler.js';
import studentService from '../services/student.service.js';

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentService.createStudent(req.body, req.file);

  return res.status(201).json({
    success: true,
    message: 'Student created successfully',
    student,
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

export { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent };
