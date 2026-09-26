import { asyncHandler } from '../utils/asyncHandler.js';
import markService from '../services/mark.service.js';

const createMark = asyncHandler(async (req, res) => {
  const mark = await markService.createMark(req.body);

  return res.status(201).json({
    success: true,
    message: 'Marks saved successfully',
    data: { mark },
  });
});

const getAllMarks = asyncHandler(async (req, res) => {
  const result = await markService.getAllMarks(req.query);
  const marks = result.marks.map((m) => m.toObject());

  return res.status(200).json({
    success: true,
    message: 'Marks fetched successfully',
    data: {
      marks,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      },
    },
  });
});

const getMarkById = asyncHandler(async (req, res) => {
  const mark = await markService.getMarkById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Mark record fetched successfully',
    data: { mark },
  });
});

const updateMark = asyncHandler(async (req, res) => {
  const mark = await markService.updateMark(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Marks updated successfully',
    data: { mark },
  });
});

const bulkSaveMarks = asyncHandler(async (req, res) => {
  const result = await markService.bulkSaveMarks(req.body);

  return res.status(200).json({
    success: true,
    message: 'Marks saved successfully',
    data: result,
  });
});

const deleteMark = asyncHandler(async (req, res) => {
  const mark = await markService.deleteMark(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Mark record deleted successfully',
    data: { id: mark._id },
  });
});

export { createMark, getAllMarks, getMarkById, updateMark, bulkSaveMarks, deleteMark };