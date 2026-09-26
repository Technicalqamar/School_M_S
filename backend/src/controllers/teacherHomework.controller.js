import { asyncHandler } from '../utils/asyncHandler.js';
import teacherHomeworkService from '../services/teacherHomework.service.js';

const createAssignment = asyncHandler(async (req, res) => {
  const result = await teacherHomeworkService.createAssignment(req.user, req.body);

  return res.status(201).json({
    success: true,
    message: 'Assignment created successfully',
    data: result,
  });
});

const getTeacherAssignments = asyncHandler(async (req, res) => {
  const result = await teacherHomeworkService.getTeacherAssignments(req.user, req.query);

  return res.status(200).json({
    success: true,
    message: 'Assignments fetched successfully',
    data: result,
  });
});

const getAssignment = asyncHandler(async (req, res) => {
  const result = await teacherHomeworkService.getAssignment(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Assignment fetched successfully',
    data: result,
  });
});

const updateAssignment = asyncHandler(async (req, res) => {
  const result = await teacherHomeworkService.updateAssignment(req.user, req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Assignment updated successfully',
    data: result,
  });
});

const deleteAssignment = asyncHandler(async (req, res) => {
  const result = await teacherHomeworkService.deleteAssignment(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Assignment deleted successfully',
    data: result,
  });
});

export {
  createAssignment,
  getTeacherAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
};