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
      // Short-lived plaintext shown once to the creating Admin. Never stored.
      temporaryCredentials: result.temporaryCredentials,
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
  await receptionistService.resetReceptionistPassword(req.params.id, newPassword, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully. The receptionist must set a new password on next login.',
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

// ---------------------------------------------------------------------------
// Portal endpoints (mounted behind protect + authorize('receptionist') +
// requirePermission(...)). Each handler is separately permission-gated by its
// route, so a missing permission is denied before the handler runs.
// ---------------------------------------------------------------------------

const getDashboard = asyncHandler(async (req, res) => {
  const data = await receptionistService.getPortalDashboard();

  return res.status(200).json({
    success: true,
    message: 'Dashboard data fetched successfully',
    data,
  });
});

const getStudents = asyncHandler(async (req, res) => {
  const result = await receptionistService.getPortalStudents(req.query);

  return res.status(200).json({
    success: true,
    message: 'Students fetched successfully',
    data: result,
  });
});

const getStudentByStudentId = asyncHandler(async (req, res) => {
  const student = await receptionistService.getPortalStudent(req.params.studentId);

  return res.status(200).json({
    success: true,
    message: 'Student fetched successfully',
    data: { student },
  });
});

const getPortalNotices = asyncHandler(async (req, res) => {
  const result = await receptionistService.getPortalNotices(req.query);

  return res.status(200).json({
    success: true,
    message: 'Notices fetched successfully',
    data: result,
  });
});

const getPortalNoticeById = asyncHandler(async (req, res) => {
  const notice = await receptionistService.getPortalNotice(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Notice fetched successfully',
    data: { notice },
  });
});

const getPortalAttendance = asyncHandler(async (req, res) => {
  const result = await receptionistService.getPortalAttendance(req.query);

  return res.status(200).json({
    success: true,
    message: 'Attendance fetched successfully',
    data: result,
  });
});

const getPortalFees = asyncHandler(async (req, res) => {
  const result = await receptionistService.getPortalFees(req.query);

  return res.status(200).json({
    success: true,
    message: 'Fee dues fetched successfully',
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
  getDashboard,
  getStudents,
  getStudentByStudentId,
  getPortalNotices,
  getPortalNoticeById,
  getPortalAttendance,
  getPortalFees,
};
