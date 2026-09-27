import { asyncHandler } from '../utils/asyncHandler.js';
import timetableEntryService from '../services/timetableEntry.service.js';

const createTimetableEntry = asyncHandler(async (req, res) => {
  const timetableEntry = await timetableEntryService.createTimetableEntry(req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Timetable entry created successfully',
    data: { timetableEntry },
  });
});

const getAllTimetableEntries = asyncHandler(async (req, res) => {
  const result = await timetableEntryService.getAllTimetableEntries(req.query);

  return res.status(200).json({
    success: true,
    message: 'Timetable entries fetched successfully',
    data: result,
  });
});

const getTimetableEntryById = asyncHandler(async (req, res) => {
  const timetableEntry = await timetableEntryService.getTimetableEntryById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Timetable entry fetched successfully',
    data: { timetableEntry },
  });
});

const updateTimetableEntry = asyncHandler(async (req, res) => {
  const timetableEntry = await timetableEntryService.updateTimetableEntry(req.params.id, req.body, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Timetable entry updated successfully',
    data: { timetableEntry },
  });
});

const deleteTimetableEntry = asyncHandler(async (req, res) => {
  await timetableEntryService.deleteTimetableEntry(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Timetable entry deleted successfully',
  });
});

export {
  createTimetableEntry,
  getAllTimetableEntries,
  getTimetableEntryById,
  updateTimetableEntry,
  deleteTimetableEntry,
};