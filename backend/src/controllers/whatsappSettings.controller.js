import { asyncHandler } from '../utils/asyncHandler.js';
import whatsappSettingsService from '../services/whatsapp/whatsappSettings.service.js';

// Every response carries only the masked, token-free settings payload. The
// stored token is never returned to the client.
const getWhatsAppStatus = asyncHandler(async (req, res) => {
  const data = await whatsappSettingsService.getStatus();

  return res.status(200).json({
    success: true,
    message: 'WhatsApp settings fetched successfully.',
    data,
  });
});

const saveWhatsAppToken = asyncHandler(async (req, res) => {
  const { apiToken } = req.body || {};

  const data = await whatsappSettingsService.saveToken({
    apiToken,
    performedBy: req.user?._id,
  });

  return res.status(200).json({
    success: true,
    message: 'WhatsApp API token saved successfully.',
    data,
  });
});

const testWhatsAppConnection = asyncHandler(async (req, res) => {
  const data = await whatsappSettingsService.testConnection();

  return res.status(200).json({
    success: true,
    message: 'WhatsApp connection test completed successfully.',
    data,
  });
});

export {
  getWhatsAppStatus,
  saveWhatsAppToken,
  testWhatsAppConnection,
};
