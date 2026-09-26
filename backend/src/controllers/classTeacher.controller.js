import { asyncHandler } from '../utils/asyncHandler.js';
import classTeacherService from '../services/classTeacher.service.js';

const getClassTeacherAssignments = asyncHandler(async (req, res) => {
  const result = await classTeacherService.getClassTeacherAssignments(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Class teacher assignments fetched successfully',
    data: result,
  });
});

const assignTeacherSubject = asyncHandler(async (req, res) => {
  const { teacherId, subjectId } = req.body;
  const assignment = await classTeacherService.assignTeacherSubject(req.params.id, teacherId, subjectId);

  return res.status(201).json({
    success: true,
    message: 'Teacher subject assignment added successfully',
    data: { assignment },
  });
});

const removeTeacherSubject = asyncHandler(async (req, res) => {
  const assignment = await classTeacherService.removeTeacherSubject(
    req.params.id,
    req.params.teacherId,
    req.params.subjectId,
  );

  return res.status(200).json({
    success: true,
    message: 'Teacher subject assignment removed successfully',
    data: { assignment },
  });
});

export { getClassTeacherAssignments, assignTeacherSubject, removeTeacherSubject };