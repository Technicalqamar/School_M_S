import { asyncHandler } from '../utils/asyncHandler.js';
import leaveService from '../services/leave.service.js';

const createLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.createLeave(req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Leave request created successfully',
    data: { leave },
  });
});

const getAllLeaves = asyncHandler(async (req, res) => {
  const result = await leaveService.getAllLeaves(req.query);

  return res.status(200).json({
    success: true,
    message: 'Leave records fetched successfully',
    data: result,
  });
});

const getLeaveById = asyncHandler(async (req, res) => {
  const leave = await leaveService.getLeaveById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Leave record fetched successfully',
    data: { leave },
  });
});

const checkLeave = asyncHandler(async (req, res) => {
  const result = await leaveService.checkApprovedLeave(req.query);

  return res.status(200).json({
    success: true,
    message: result.onLeave ? 'Person is on approved leave for this date' : 'Person is not on approved leave for this date',
    data: result,
  });
});

const updateLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.updateLeave(req.params.id, req.body, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Leave record updated successfully',
    data: { leave },
  });
});

const approveLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.approveLeave(req.params.id, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Leave approved successfully',
    data: { leave },
  });
});

const rejectLeave = asyncHandler(async (req, res) => {
  const leave = await leaveService.rejectLeave(req.params.id, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Leave rejected successfully',
    data: { leave },
  });
});

const deleteLeave = asyncHandler(async (req, res) => {
  await leaveService.deleteLeave(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Leave record deleted successfully',
  });
});

export {
  createLeave,
  getAllLeaves,
  getLeaveById,
  checkLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  deleteLeave,
};