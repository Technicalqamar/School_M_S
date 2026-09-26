import { asyncHandler } from '../utils/asyncHandler.js';
import studentFeesService from '../services/studentFees.service.js';

const getStudentFeeOverview = asyncHandler(async (req, res) => {
  const result = await studentFeesService.getMyFeeOverview(req.user);

  return res.status(200).json({
    success: true,
    message: 'Fee overview fetched successfully',
    data: result,
  });
});

const getStudentFeeHistory = asyncHandler(async (req, res) => {
  const { academicYear, feeMonth, feeType, search, page, limit } = req.query;

  const result = await studentFeesService.getMyFeeHistory(req.user, {
    academicYear,
    feeMonth,
    feeType,
    search,
    page,
    limit,
  });

  return res.status(200).json({
    success: true,
    message: 'Fee history fetched successfully',
    data: result,
  });
});

const getStudentVouchers = asyncHandler(async (req, res) => {
  const result = await studentFeesService.getMyVouchers(req.user, {
    academicYear: req.query.academicYear,
  });

  return res.status(200).json({
    success: true,
    message: 'Vouchers fetched successfully',
    data: result,
  });
});

const getStudentVoucher = asyncHandler(async (req, res) => {
  const result = await studentFeesService.getMyVoucher(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Voucher fetched successfully',
    data: result,
  });
});

const getStudentReceipt = asyncHandler(async (req, res) => {
  const result = await studentFeesService.getMyReceipt(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Receipt fetched successfully',
    data: result,
  });
});

export {
  getStudentFeeOverview,
  getStudentFeeHistory,
  getStudentVouchers,
  getStudentVoucher,
  getStudentReceipt,
};