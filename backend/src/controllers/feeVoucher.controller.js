import { asyncHandler } from '../utils/asyncHandler.js';
import feeVoucherService from '../services/feeVoucher.service.js';

const generateVouchers = asyncHandler(async (req, res) => {
  const result = await feeVoucherService.generateVouchers(req.body);

  return res.status(201).json({
    success: true,
    message: 'Vouchers generated successfully',
    data: result,
  });
});

const getVouchers = asyncHandler(async (req, res) => {
  const result = await feeVoucherService.getVouchers(req.query);

  return res.status(200).json({
    success: true,
    message: 'Vouchers fetched successfully',
    data: result,
  });
});

const getVoucher = asyncHandler(async (req, res) => {
  const result = await feeVoucherService.getVoucher(req.params.voucherId);

  return res.status(200).json({
    success: true,
    message: 'Voucher fetched successfully',
    data: result,
  });
});

export { generateVouchers, getVouchers, getVoucher };