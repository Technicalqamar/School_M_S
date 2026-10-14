import { asyncHandler } from '../utils/asyncHandler.js';
import receptionistService from '../services/receptionist.service.js';

// ---------------------------------------------------------------------------
// Admin management endpoints (mounted behind protect + authorize('admin')).
// ---------------------------------------------------------------------------

const createReceptionist = asyncHandler(async (req, res) => {
  const result = await receptionistService.createReceptionist(req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Receptionist account created successfully',
    data: {
      receptionist: result.receptionist,
    },
  });
});

const getAllReceptionists = asyncHandler(async (req, res) => {
  const result = await receptionistService.getReceptionists(req.query);

  return res.status(200).json({
    success: true,
    message: 'Receptionist accounts fetched successfully',
    data: {
      receptionists: result.receptionists,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getReceptionistById = asyncHandler(async (req, res) => {
  const receptionist = await receptionistService.getReceptionistById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Receptionist account fetched successfully',
    data: { receptionist },
  });
});

const updateReceptionist = asyncHandler(async (req, res) => {
  const receptionist = await receptionistService.updateReceptionist(
    req.params.id,
    req.body,
    req.user?._id,
  );

  return res.status(200).json({
    success: true,
    message: 'Receptionist account updated successfully',
    data: { receptionist },
  });
});

const updateReceptionistStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const receptionist = await receptionistService.updateReceptionistStatus(
    req.params.id,
    isActive,
    req.user?._id,
  );

  return res.status(200).json({
    success: true,
    message: isActive ? 'Receptionist account activated' : 'Receptionist account deactivated',
    data: { receptionist },
  });
});

const updateReceptionistPermissions = asyncHandler(async (req, res) => {
  const { permissions } = req.body;
  const receptionist = await receptionistService.updateReceptionistPermissions(
    req.params.id,
    permissions,
    req.user?._id,
  );

  return res.status(200).json({
    success: true,
    message: 'Permissions updated successfully',
    data: { receptionist },
  });
});

const resetReceptionistPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const receptionist = await receptionistService.resetReceptionistPassword(
    req.params.id,
    newPassword,
    req.user?._id,
    req.user?.role,
  );

  return res.status(200).json({
    success: true,
    message: 'Receptionist password reset successfully',
    data: { receptionist },
  });
});

const deleteReceptionist = asyncHandler(async (req, res) => {
  const result = await receptionistService.deleteReceptionist(req.params.id, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Receptionist account deleted successfully',
    data: result,
  });
});

export {
  createReceptionist,
  getAllReceptionists,
  getReceptionistById,
  updateReceptionist,
  updateReceptionistStatus,
  updateReceptionistPermissions,
  resetReceptionistPassword,
  deleteReceptionist,
};