import { asyncHandler } from '../utils/asyncHandler.js';
import examScheduleService from '../services/examSchedule.service.js';

const createExamSchedule = asyncHandler(async (req, res) => {
  const examSchedule = await examScheduleService.createExamSchedule(req.body);

  return res.status(201).json({
    success: true,
    message: 'Exam schedule created successfully',
    data: { examSchedule },
  });
});

const getAllExamSchedules = asyncHandler(async (req, res) => {
  const result = await examScheduleService.getAllExamSchedules(req.query);
  const schedules = result.schedules.map((e) => e.toObject());

  return res.status(200).json({
    success: true,
    message: 'Exam schedules fetched successfully',
    data: {
      schedules,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getExamScheduleById = asyncHandler(async (req, res) => {
  const examSchedule = await examScheduleService.getExamScheduleById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Exam schedule fetched successfully',
    data: { examSchedule },
  });
});

const updateExamSchedule = asyncHandler(async (req, res) => {
  const examSchedule = await examScheduleService.updateExamSchedule(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Exam schedule updated successfully',
    data: { examSchedule },
  });
});

const deleteExamSchedule = asyncHandler(async (req, res) => {
  const examSchedule = await examScheduleService.deleteExamSchedule(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Exam schedule deleted successfully',
    data: { id: examSchedule._id },
  });
});

export { createExamSchedule, getAllExamSchedules, getExamScheduleById, updateExamSchedule, deleteExamSchedule };