import { asyncHandler } from '../utils/asyncHandler.js';
import teacherService from '../services/teacher.service.js';

const createTeacher = asyncHandler(async (req, res) => {
  const teacher = await teacherService.createTeacher(req.body, req.file);

  return res.status(201).json({
    success: true,
    message: 'Teacher created successfully',
    data: teacher,
  });
});

const getAllTeachers = asyncHandler(async (req, res) => {
  const result = await teacherService.getAllTeachers(req.query);
  const teachers = result.teachers.map((t) => t.toObject());

  return res.status(200).json({
    success: true,
    message: 'Teachers fetched successfully',
    data: {
      teachers,
      pagination: {
        totalTeachers: result.totalTeachers,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getTeacherById = asyncHandler(async (req, res) => {
  const teacher = await teacherService.getTeacherById(req.params.teacherId);

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Teacher fetched successfully',
    data: { teacher },
  });
});

const updateTeacher = asyncHandler(async (req, res) => {
  const teacher = await teacherService.updateTeacher(req.params.teacherId, req.body, req.file);

  return res.status(200).json({
    success: true,
    message: 'Teacher updated successfully',
    data: { teacher },
  });
});

const deleteTeacher = asyncHandler(async (req, res) => {
  const teacher = await teacherService.deleteTeacher(req.params.teacherId, req.user._id);

  return res.status(200).json({
    success: true,
    message: 'Teacher deleted successfully',
    data: {
      teacherId: teacher.teacherId,
    },
  });
});

export { createTeacher, getAllTeachers, getTeacherById, updateTeacher, deleteTeacher };
