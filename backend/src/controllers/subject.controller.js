import { asyncHandler } from '../utils/asyncHandler.js';
import subjectService from '../services/subject.service.js';

const createSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.createSubject(req.body);

  return res.status(201).json({
    success: true,
    message: 'Subject created successfully',
    data: { subject },
  });
});

const getAllSubjects = asyncHandler(async (req, res) => {
  const subjects = await subjectService.getAllSubjects();

  return res.status(200).json({
    success: true,
    message: 'Subjects fetched successfully',
    data: { subjects },
  });
});

const getSubjectById = asyncHandler(async (req, res) => {
  const subject = await subjectService.getSubjectById(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Subject fetched successfully',
    data: { subject },
  });
});

const updateSubject = asyncHandler(async (req, res) => {
  const subject = await subjectService.updateSubject(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Subject updated successfully',
    data: { subject },
  });
});

const deleteSubject = asyncHandler(async (req, res) => {
  await subjectService.deleteSubject(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Subject deleted successfully',
  });
});

const assignSubjectsToClass = asyncHandler(async (req, res) => {
  const { className, academicYear, subjectIds } = req.body;
  const result = await subjectService.assignSubjectsToClass(className, academicYear, subjectIds);

  return res.status(200).json({
    success: true,
    message: 'Subject assignments updated successfully',
    data: {
      class: result.classDoc,
      added: result.added,
      removed: result.removed,
    },
  });
});

const getClassAssignments = asyncHandler(async (req, res) => {
  const { className, academicYear } = req.query;
  const result = await subjectService.getClassAssignments(className, academicYear);

  return res.status(200).json({
    success: true,
    message: 'Class assignments fetched successfully',
    data: result,
  });
});

const getClassAssignmentYears = asyncHandler(async (req, res) => {
  const years = await subjectService.getClassAssignmentAcademicYears();

  return res.status(200).json({
    success: true,
    message: 'Academic years fetched successfully',
    data: { years },
  });
});

export {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  assignSubjectsToClass,
  getClassAssignments,
  getClassAssignmentYears,
};
