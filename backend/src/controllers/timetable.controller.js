import { asyncHandler } from '../utils/asyncHandler.js';
import timetableService from '../services/timetable.service.js';

const createTimetable = asyncHandler(async (req, res) => {
  const { timetable, warnings } = await timetableService.createTimetable(req.body, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Timetable created successfully',
    data: { timetable },
    ...(warnings?.length ? { warnings } : {}),
  });
});

const getAllTimetables = asyncHandler(async (req, res) => {
  const timetables = await timetableService.getAllTimetables();

  return res.status(200).json({
    success: true,
    message: 'Timetables fetched successfully',
    data: { timetables },
  });
});

const getTimetableByClass = asyncHandler(async (req, res) => {
  const timetables = await timetableService.getTimetableByClass(req.params.classId);

  return res.status(200).json({
    success: true,
    message: 'Timetables fetched successfully',
    data: { timetables },
  });
});

const getTimetableById = asyncHandler(async (req, res) => {
  const timetable = await timetableService.getTimetableById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Timetable fetched successfully',
    data: { timetable },
  });
});

const updateTimetable = asyncHandler(async (req, res) => {
  const { timetable, warnings } = await timetableService.updateTimetable(req.params.id, req.body, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Timetable updated successfully',
    data: { timetable },
    ...(warnings?.length ? { warnings } : {}),
  });
});

const deleteTimetable = asyncHandler(async (req, res) => {
  await timetableService.deleteTimetable(req.params.id, req.user?._id);

  return res.status(200).json({
    success: true,
    message: 'Timetable deleted successfully',
  });
});

const getClassSubjects = asyncHandler(async (req, res) => {
  const subjects = await timetableService.getAvailableSubjectsForClass(req.params.classId);

  return res.status(200).json({
    success: true,
    message: 'Subjects fetched successfully',
    data: { subjects },
  });
});

const getSubjectTeachers = asyncHandler(async (req, res) => {
  const teachers = await timetableService.getAvailableTeachersForSubject(req.params.subjectId);

  return res.status(200).json({
    success: true,
    message: 'Teachers fetched successfully',
    data: { teachers },
  });
});

export {
  createTimetable,
  getAllTimetables,
  getTimetableByClass,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  getClassSubjects,
  getSubjectTeachers,
};
