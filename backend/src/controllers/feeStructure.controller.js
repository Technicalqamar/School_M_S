import { asyncHandler } from '../utils/asyncHandler.js';
import feeStructureService from '../services/feeStructure.service.js';

const createFeeStructure = asyncHandler(async (req, res) => {
  const newStructure = await feeStructureService.createFeeStructure(req.body);

  return res.status(201).json({
    success: true,
    message: 'Fee structure created successfully',
    data: { feeStructure: newStructure },
  });
});

const getAllFeeStructures = asyncHandler(async (req, res) => {
  const result = await feeStructureService.getAllFeeStructures();

  return res.status(200).json({
    success: true,
    message: 'Fee structures fetched successfully',
    data: {
      structures: result.structures,
      statistics: result.statistics,
    },
  });
});

const updateFeeStructure = asyncHandler(async (req, res) => {
  const updated = await feeStructureService.updateFeeStructure(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Fee structure updated successfully',
    data: { feeStructure: updated },
  });
});

const deleteFeeStructure = asyncHandler(async (req, res) => {
  await feeStructureService.deleteFeeStructure(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Fee structure deleted successfully',
  });
});

export { createFeeStructure, getAllFeeStructures, updateFeeStructure, deleteFeeStructure };