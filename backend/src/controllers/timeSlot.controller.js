import { asyncHandler } from '../utils/asyncHandler.js';
import timeSlotService from '../services/timeSlot.service.js';

const createTimeSlot = asyncHandler(async (req, res) => {
  const timeSlot = await timeSlotService.createTimeSlot(req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Time slot created successfully',
    data: { timeSlot },
  });
});

const getAllTimeSlots = asyncHandler(async (req, res) => {
  const result = await timeSlotService.getAllTimeSlots(req.query);

  return res.status(200).json({
    success: true,
    message: 'Time slots fetched successfully',
    data: result,
  });
});

const getTimeSlotById = asyncHandler(async (req, res) => {
  const timeSlot = await timeSlotService.getTimeSlotById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Time slot fetched successfully',
    data: { timeSlot },
  });
});

const updateTimeSlot = asyncHandler(async (req, res) => {
  const timeSlot = await timeSlotService.updateTimeSlot(req.params.id, req.body, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Time slot updated successfully',
    data: { timeSlot },
  });
});

const deleteTimeSlot = asyncHandler(async (req, res) => {
  await timeSlotService.deleteTimeSlot(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Time slot deleted successfully',
  });
});

export {
  createTimeSlot,
  getAllTimeSlots,
  getTimeSlotById,
  updateTimeSlot,
  deleteTimeSlot,
};