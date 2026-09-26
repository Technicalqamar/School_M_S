import { asyncHandler } from '../utils/asyncHandler.js';
import feeOutstandingService from '../services/feeOutstanding.service.js';

const getOutstandingDues = asyncHandler(async (req, res) => {
  const result = await feeOutstandingService.getOutstandingDues();

  return res.status(200).json({
    success: true,
    message: 'Outstanding dues fetched successfully',
    data: result,
  });
});

export { getOutstandingDues };