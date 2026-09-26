import { asyncHandler } from '../utils/asyncHandler.js';
import examService from '../services/exam.service.js';

const createExam = asyncHandler(async (req, res) => {
  const exam = await examService.createExam(req.body);

  return res.status(201).json({
    success: true,
    message: 'Exam created successfully',
    data: { exam },
  });
});

const getAllExams = asyncHandler(async (req, res) => {
  const result = await examService.getAllExams(req.query);
  const exams = result.exams.map((e) => e.toObject());

  return res.status(200).json({
    success: true,
    message: 'Exams fetched successfully',
    data: {
      exams,
      pagination: {
        totalExams: result.totalExams,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getExamById = asyncHandler(async (req, res) => {
  const exam = await examService.getExamById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Exam fetched successfully',
    data: { exam },
  });
});

const updateExam = asyncHandler(async (req, res) => {
  const exam = await examService.updateExam(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Exam updated successfully',
    data: { exam },
  });
});

const deleteExam = asyncHandler(async (req, res) => {
  const exam = await examService.deleteExam(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Exam deleted successfully',
    data: { examId: exam._id },
  });
});

export { createExam, getAllExams, getExamById, updateExam, deleteExam };