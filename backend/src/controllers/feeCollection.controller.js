import { asyncHandler } from '../utils/asyncHandler.js';
import feeCollectionService from '../services/feeCollection.service.js';

const collectFee = asyncHandler(async (req, res) => {
  const payment = await feeCollectionService.collectFee(req.body);

  return res.status(201).json({
    success: true,
    message: 'Fee collected successfully',
    data: { payment },
  });
});

const getFeeCollections = asyncHandler(async (req, res) => {
  const result = await feeCollectionService.getFeeCollections(req.query);

  return res.status(200).json({
    success: true,
    message: 'Fee records fetched successfully',
    data: { payments: result.payments },
  });
});

export { collectFee, getFeeCollections };