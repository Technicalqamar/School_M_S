import { asyncHandler } from '../utils/asyncHandler.js';
import schoolSettingsService from '../services/schoolSettings.service.js';

const getSchoolSettings = asyncHandler(async (req, res) => {
  const settings = await schoolSettingsService.getSchoolSettings();

  return res.status(200).json({
    success: true,
    message: 'School settings fetched successfully.',
    data: { settings },
  });
});

const getPublicSchoolSettings = asyncHandler(async (req, res) => {
  const settings = await schoolSettingsService.getSchoolSettings();
  const logo = settings.schoolLogo?.secure_url || '';
  const adminPanelLogo = settings.adminPanelLogo?.secure_url || '';

  return res.status(200).json({
    success: true,
    data: {
      schoolName: settings.schoolName || '',
      logo,
      adminPanelLogo,
      principalName: settings.principalName || '',
      currentAcademicYear: settings.currentAcademicYear || '',
    },
  });
});

const updateSchoolInformation = asyncHandler(async (req, res) => {
  const settings = await schoolSettingsService.updateGeneralInformation(req.body);

  return res.status(200).json({
    success: true,
    message: 'School information updated successfully.',
    data: { settings },
  });
});

const updateAcademicSettings = asyncHandler(async (req, res) => {
  const settings = await schoolSettingsService.updateAcademicConfiguration(req.body);

  return res.status(200).json({
    success: true,
    message: 'Academic settings updated successfully.',
    data: { settings },
  });
});

const updateBrandingSettings = asyncHandler(async (req, res) => {
  const settings = await schoolSettingsService.updateBrandingDocuments(req.body);

  return res.status(200).json({
    success: true,
    message: 'Branding settings updated successfully.',
    data: { settings },
  });
});

const updateSystemPreferences = asyncHandler(async (req, res) => {
  const settings = await schoolSettingsService.updateSystemPreferences(req.body);

  return res.status(200).json({
    success: true,
    message: 'System preferences updated successfully.',
    data: { settings },
  });
});

const updateSchoolImage = asyncHandler(async (req, res) => {
  const { field } = req.params;
  const settings = await schoolSettingsService.updateSchoolImage(field, req.file);

  return res.status(200).json({
    success: true,
    message: 'Image updated successfully.',
    data: { settings },
  });
});

const removeSchoolImage = asyncHandler(async (req, res) => {
  const { field } = req.params;
  const settings = await schoolSettingsService.removeSchoolImage(field);

  return res.status(200).json({
    success: true,
    message: 'Image removed successfully.',
    data: { settings },
  });
});

export {
  getSchoolSettings,
  getPublicSchoolSettings,
  updateSchoolInformation,
  updateAcademicSettings,
  updateBrandingSettings,
  updateSystemPreferences,
  updateSchoolImage,
  removeSchoolImage,
};
