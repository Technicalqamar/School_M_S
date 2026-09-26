import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import portalAccessService from '../services/portalAccess.service.js';

const openPortal = asyncHandler(async (req, res) => {
  const result = await portalAccessService.authorizeStudentPortalAccess({
    admin: req.user,
    studentId: req.params.studentId,
  });

  return res.status(200).json({
    success: true,
    message: 'Student portal access authorized',
    data: result,
  });
});

const getPortalContext = asyncHandler(async (req, res) => {
  if (req.accessType !== portalAccessService.ACCESS_TYPE) {
    throw new ApiError(403, 'This endpoint is only available for Administrator-authorized portal access');
  }

  const result = await portalAccessService.getPortalContext({
    account: req.user,
    studentId: req.accessStudentId,
    adminId: req.accessAdminId,
  });

  return res.status(200).json({
    success: true,
    message: 'Portal context retrieved successfully',
    data: result,
  });
});

const endPortalAccess = asyncHandler(async (req, res) => {
  await portalAccessService.endPortalAccess({
    payload: {
      accessType: req.accessType,
      adminId: req.accessAdminId,
      studentId: req.accessStudentId,
    },
  });

  return res.status(200).json({
    success: true,
    message: 'Portal access ended successfully',
  });
});

export { openPortal, getPortalContext, endPortalAccess };