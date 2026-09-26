import { asyncHandler } from '../utils/asyncHandler.js';
import idCardManagementService from '../services/idCardManagement.service.js';

const getStudentsWithCards = asyncHandler(async (req, res) => {
  const { academicYear, class: className, status, search } = req.query;

  const result = await idCardManagementService.getStudentsWithCards({
    academicYear,
    className,
    status,
    search,
  });

  return res.status(200).json({
    success: true,
    message: 'Students with ID card data fetched successfully',
    data: result,
  });
});

const generateQRCodes = asyncHandler(async (req, res) => {
  const result = await idCardManagementService.generateQRCodes(req.body, req.user._id);

  const message =
    result.generatedCount > 0
      ? `QR codes generated for ${result.generatedCount} student${result.generatedCount !== 1 ? 's' : ''}`
      : 'All selected students already have QR codes';

  return res.status(200).json({
    success: true,
    message,
    data: result,
  });
});

const regenerateQRCode = asyncHandler(async (req, res) => {
  const result = await idCardManagementService.regenerateQRCode(req.params.studentId, req.user._id);

  return res.status(200).json({
    success: true,
    message: `QR code regenerated for ${result.fullName}`,
    data: result,
  });
});

const markAsPrinted = asyncHandler(async (req, res) => {
  const result = await idCardManagementService.markAsPrinted(req.body.studentIds, req.user._id);

  return res.status(200).json({
    success: true,
    message: `${result.updatedCount} card${result.updatedCount !== 1 ? 's' : ''} marked as printed`,
    data: result,
  });
});

const updateCardDesign = asyncHandler(async (req, res) => {
  const result = await idCardManagementService.updateCardDesign(
    req.params.studentId,
    req.body,
    req.user._id,
  );

  return res.status(200).json({
    success: true,
    message: 'ID card design updated successfully',
    data: result,
  });
});

export {
  getStudentsWithCards,
  generateQRCodes,
  regenerateQRCode,
  markAsPrinted,
  updateCardDesign,
};