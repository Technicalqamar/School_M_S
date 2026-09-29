import { asyncHandler } from '../utils/asyncHandler.js';
import studentPortalExamService from '../services/studentPortalExam.service.js';

const getMyExams = asyncHandler(async (req, res) => {
  const data = await studentPortalExamService.getMyExams(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    {
      academicYear: req.query.academicYear,
      examId: req.query.examId,
      studentId: req.query.studentId,
      student: req.query.student,
      classId: req.query.classId,
      class: req.query.class,
      className: req.query.className,
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Exams fetched successfully',
    data,
  });
});

const getMyExamSchedule = asyncHandler(async (req, res) => {
  const data = await studentPortalExamService.getMyExamSchedule(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    {
      academicYear: req.query.academicYear,
      examId: req.query.examId,
      studentId: req.query.studentId,
      student: req.query.student,
      classId: req.query.classId,
      class: req.query.class,
      className: req.query.className,
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Exam schedule fetched successfully',
    data,
  });
});

const getMyResults = asyncHandler(async (req, res) => {
  const data = await studentPortalExamService.getMyResults(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    {
      academicYear: req.query.academicYear,
      examId: req.query.examId,
      studentId: req.query.studentId,
      student: req.query.student,
      classId: req.query.classId,
      class: req.query.class,
      className: req.query.className,
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Results fetched successfully',
    data,
  });
});

const getMyAdmitCard = asyncHandler(async (req, res) => {
  const data = await studentPortalExamService.getMyAdmitCard(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    {
      academicYear: req.query.academicYear,
      examId: req.query.examId,
      studentId: req.query.studentId,
      student: req.query.student,
      classId: req.query.classId,
      class: req.query.class,
      className: req.query.className,
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Admit card fetched successfully',
    data,
  });
});

export { getMyExams, getMyExamSchedule, getMyResults, getMyAdmitCard };