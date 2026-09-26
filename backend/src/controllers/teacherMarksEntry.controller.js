import { asyncHandler } from '../utils/asyncHandler.js';
import teacherMarksEntryService from '../services/teacherMarksEntry.service.js';

const getMyExams = asyncHandler(async (req, res) => {
  const result = await teacherMarksEntryService.getMyExams(req.user);

  return res.status(200).json({
    success: true,
    message: 'My exams fetched successfully',
    data: result,
  });
});

const getMyExamSubjects = asyncHandler(async (req, res) => {
  const result = await teacherMarksEntryService.getMyExamSubjects(req.user, {
    examId: String(req.query.examId || ''),
    className: String(req.query.className || ''),
    subjectId: req.query.subjectId ? String(req.query.subjectId) : '',
  });

  return res.status(200).json({
    success: true,
    message: 'My exam subjects fetched successfully',
    data: result,
  });
});

const getMyClassStudents = asyncHandler(async (req, res) => {
  const result = await teacherMarksEntryService.getMyClassStudents(req.user, {
    className: String(req.query.className || ''),
    subjectId: req.query.subjectId ? String(req.query.subjectId) : '',
    search: typeof req.query.search === 'string' ? req.query.search.trim() : '',
  });

  return res.status(200).json({
    success: true,
    message: 'My class students fetched successfully',
    data: result,
  });
});

const getMyMarks = asyncHandler(async (req, res) => {
  const result = await teacherMarksEntryService.getMyMarks(req.user, {
    examId: String(req.query.examId || ''),
    subjectId: req.query.subjectId ? String(req.query.subjectId) : '',
    className: String(req.query.className || ''),
    academicYear: req.query.academicYear ? String(req.query.academicYear) : '',
  });

  return res.status(200).json({
    success: true,
    message: 'My marks fetched successfully',
    data: result,
  });
});

const bulkSaveMarks = asyncHandler(async (req, res) => {
  const result = await teacherMarksEntryService.bulkSaveMarks(req.user, req.body);

  return res.status(200).json({
    success: true,
    message: 'Marks saved successfully',
    data: result,
  });
});

export { getMyExams, getMyExamSubjects, getMyClassStudents, getMyMarks, bulkSaveMarks };
