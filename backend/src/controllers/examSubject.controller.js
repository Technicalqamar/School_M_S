import { asyncHandler } from '../utils/asyncHandler.js';
import examSubjectService from '../services/examSubject.service.js';

const createExamSubject = asyncHandler(async (req, res) => {
  const examSubject = await examSubjectService.createExamSubject(req.body);

  return res.status(201).json({
    success: true,
    message: 'Subject marks configured successfully',
    data: { examSubject },
  });
});

const getAllExamSubjects = asyncHandler(async (req, res) => {
  const result = await examSubjectService.getAllExamSubjects(req.query);
  const examSubjects = result.examSubjects.map((e) => e.toObject());

  return res.status(200).json({
    success: true,
    message: 'Subject marks fetched successfully',
    data: {
      examSubjects: examSubjects,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getExamSubjectById = asyncHandler(async (req, res) => {
  const examSubject = await examSubjectService.getExamSubjectById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Subject marks configuration fetched successfully',
    data: { examSubject },
  });
});

const updateExamSubject = asyncHandler(async (req, res) => {
  const examSubject = await examSubjectService.updateExamSubject(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Subject marks configuration updated successfully',
    data: { examSubject },
  });
});

const deleteExamSubject = asyncHandler(async (req, res) => {
  const examSubject = await examSubjectService.deleteExamSubject(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Subject marks configuration deleted successfully',
    data: { id: examSubject._id },
  });
});

export { createExamSubject, getAllExamSubjects, getExamSubjectById, updateExamSubject, deleteExamSubject };