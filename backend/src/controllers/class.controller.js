import { asyncHandler } from '../utils/asyncHandler.js';
import classService from '../services/class.service.js';

const createClass = asyncHandler(async (req, res) => {
  const newClass = await classService.createClass(req.body);

  return res.status(201).json({
    success: true,
    message: 'Class created successfully',
    data: { class: newClass },
  });
});

const getAllClasses = asyncHandler(async (req, res) => {
  const result = await classService.getAllClasses();

  return res.status(200).json({
    success: true,
    message: 'Classes fetched successfully',
    data: {
      classes: result.classes,
      statistics: result.statistics,
    },
  });
});

const updateClass = asyncHandler(async (req, res) => {
  const updated = await classService.updateClass(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Class updated successfully',
    data: { class: updated },
  });
});

const deleteClass = asyncHandler(async (req, res) => {
  await classService.deleteClass(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Class deleted successfully',
  });
});

const getClassDetails = asyncHandler(async (req, res) => {
  const result = await classService.getClassDetails(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Class details fetched successfully',
    data: result,
  });
});

export { createClass, getAllClasses, updateClass, deleteClass, getClassDetails };
