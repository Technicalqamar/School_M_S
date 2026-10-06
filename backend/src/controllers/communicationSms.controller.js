import { asyncHandler } from '../utils/asyncHandler.js';
import communicationSmsService from '../services/communicationSms.service.js';

const createSmsMessage = asyncHandler(async (req, res) => {
  const sms = await communicationSmsService.createSmsMessage(req.body, req.user?._id);
  return res.status(201).json({
    success: true,
    message: 'SMS message created successfully',
    data: { sms },
  });
});

const getSmsMessages = asyncHandler(async (req, res) => {
  const result = await communicationSmsService.getSmsMessages(req.query);
  return res.status(200).json({
    success: true,
    message: 'SMS messages fetched successfully',
    data: result,
  });
});

const getSmsMessageById = asyncHandler(async (req, res) => {
  const sms = await communicationSmsService.getSmsMessageById(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'SMS message fetched successfully',
    data: { sms },
  });
});

const updateSmsMessageStatus = asyncHandler(async (req, res) => {
  const sms = await communicationSmsService.updateSmsMessageStatus(req.params.id, req.body.status);
  return res.status(200).json({
    success: true,
    message: 'SMS message status updated successfully',
    data: { sms },
  });
});

const deleteSmsMessage = asyncHandler(async (req, res) => {
  await communicationSmsService.deleteSmsMessage(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'SMS message deleted successfully',
  });
});

export {
  createSmsMessage,
  getSmsMessages,
  getSmsMessageById,
  updateSmsMessageStatus,
  deleteSmsMessage,
};