import { asyncHandler } from '../utils/asyncHandler.js';
import noticeService from '../services/notice.service.js';

const createNotice = asyncHandler(async (req, res) => {
  const notice = await noticeService.createNotice(req.body, req.user?._id);
  return res.status(201).json({
    success: true,
    message: 'Notice created successfully',
    data: { notice },
  });
});

const getNotices = asyncHandler(async (req, res) => {
  const result = await noticeService.getNotices(req.query);
  return res.status(200).json({
    success: true,
    message: 'Notices fetched successfully',
    data: result,
  });
});

const getNoticeById = asyncHandler(async (req, res) => {
  const notice = await noticeService.getNoticeById(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'Notice fetched successfully',
    data: { notice },
  });
});

const updateNotice = asyncHandler(async (req, res) => {
  const notice = await noticeService.updateNotice(req.params.id, req.body, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notice updated successfully',
    data: { notice },
  });
});

const deleteNotice = asyncHandler(async (req, res) => {
  await noticeService.deleteNotice(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'Notice deleted successfully',
  });
});

export { createNotice, getNotices, getNoticeById, updateNotice, deleteNotice };