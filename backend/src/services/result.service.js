import mongoose from 'mongoose';
import Exam from '../models/exam.model.js';
import ExamSubject from '../models/examSubject.model.js';
import Mark from '../models/mark.model.js';
import Student from '../models/student.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori',
  'Nursery',
  'KG 1',
  'KG 2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const GRADE_SYSTEM = [
  { min: 90, max: 100, grade: 'A+' },
  { min: 80, max: 89, grade: 'A' },
  { min: 70, max: 79, grade: 'B' },
  { min: 60, max: 69, grade: 'C' },
  { min: 50, max: 59, grade: 'D' },
  { min: 0, max: 49, grade: 'F' },
];

const getGrade = (pct) => {
  if (pct === null || pct === undefined) return '-';
  for (const g of GRADE_SYSTEM) {
    if (pct >= g.min && pct <= g.max) return g.grade;
  }
  return 'F';
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();
  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear);
  }
  return String(new Date().getFullYear());
};

const resolveAcademicYear = async (requestedYear) => {
  if (requestedYear) {
    const trimmed = String(requestedYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(trimmed)) {
      throw new ApiError(400, 'Academic year must be a valid year (e.g. 2025)');
    }
    return trimmed;
  }
  return getCurrentAcademicYear();
};

const getStudent = async (rawStudentId) => {
  const studentId = String(rawStudentId || '').trim();
  if (!studentId) {
    return null;
  }

  let student = null;
  if (mongoose.Types.ObjectId.isValid(studentId)) {
    student = await Student.findById(studentId);
  }
  if (!student) {
    student = await Student.findOne({
      studentId: new RegExp(`^${escapeRegex(studentId)}$`, 'i'),
    });
  }
  return student;
};

const buildSubjectResult = (config, mark) => {
  const totalMarks = mark && typeof mark.totalMarks === 'number' ? mark.totalMarks : config.totalMarks;
  const obtainedMarks = mark ? mark.obtainedMarks : null;
  const entered = Boolean(mark);
  const percentage = entered ? Number(((obtainedMarks / totalMarks) * 100).toFixed(1)) : null;

  return {
    subjectName: config.subjectId?.subjectName || '-',
    subjectCode: config.subjectId?.subjectCode || '',
    totalMarks,
    passingMarks: config.passingMarks,
    obtainedMarks,
    percentage,
    grade: entered ? getGrade(percentage) : '-',
    passed: entered ? obtainedMarks >= config.passingMarks : false,
    entered,
  };
};

const buildStudentResult = (student, exam, examSubjects, marksBySubject) => {
  const subjectResults = examSubjects.map((config) =>
    buildSubjectResult(config, marksBySubject.get(String(config.subjectId?._id || config.subjectId))),
  );

  const totalMarks = subjectResults.reduce((sum, s) => sum + s.totalMarks, 0);
  const obtainedMarksAll = subjectResults.filter((s) => s.entered).reduce((sum, s) => sum + s.obtainedMarks, 0);
  const allEntered = subjectResults.every((s) => s.entered);
  const allPassed = subjectResults.every((s) => !s.entered || s.passed);
  const percentage = allEntered ? Number(((obtainedMarksAll / totalMarks) * 100).toFixed(1)) : null;

  let status;
  if (!allEntered) {
    status = 'Pending';
  } else if (allPassed) {
    status = 'Passed';
  } else {
    status = 'Failed';
  }

  return {
    student: {
      _id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
      fatherName: student.fatherName,
      studentImage: student.studentImage || '',
      className: student.class,
      academicYear: String(student.academicYear),
    },
    exam: {
      name: exam.name,
      type: exam.type,
      academicYear: String(exam.academicYear),
    },
    className: String(student.class),
    academicYear: String(exam.academicYear),
    subjectResults,
    totalMarks,
    obtainedMarks: allEntered ? obtainedMarksAll : null,
    percentage,
    grade: percentage !== null ? getGrade(percentage) : '-',
    status,
    allEntered,
  };
};

const getResult = async (query = {}) => {
  const { academicYear: rawAcademicYear, examId: rawExamId, className: rawClassName, studentId: rawStudentId } = query;

  const academicYear = await resolveAcademicYear(rawAcademicYear);

  const className = String(rawClassName || '').trim();
  if (!className) {
    throw new ApiError(400, 'Class is required');
  }
  if (!VALID_CLASS_NAMES.includes(className)) {
    throw new ApiError(400, `"${className}" is not a valid class name`);
  }

  const examId = String(rawExamId || '').trim();
  if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
    throw new ApiError(400, 'Invalid exam id');
  }

  const exam = await Exam.findOne({ _id: examId, status: 'Active' });
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }
  if (String(exam.academicYear) !== String(academicYear)) {
    throw new ApiError(400, 'The exam does not belong to the selected academic year');
  }

  const examClasses = Array.isArray(exam.classes) ? exam.classes.map(String) : [];
  if (!examClasses.includes(className)) {
    throw new ApiError(400, `Class "${className}" is not configured for this exam`);
  }

  const [examSubjects, marks] = await Promise.all([
    ExamSubject.find({
      examId,
      className,
      academicYear: String(academicYear),
      status: 'Active',
    })
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ createdAt: 1 })
      .lean(),
    Mark.find({
      examId,
      className,
      academicYear: String(academicYear),
    })
      .lean(),
  ]);

  if (examSubjects.length === 0) {
    throw new ApiError(404, 'No subjects have been configured with marks for this exam and class');
  }

  const marksByStudent = new Map();
  marks.forEach((mark) => {
    const studentKey = String(mark.studentId);
    if (!marksByStudent.has(studentKey)) {
      marksByStudent.set(studentKey, new Map());
    }
    marksByStudent.get(studentKey).set(String(mark.subjectId), mark);
  });

  const buildForStudent = (student) =>
    buildStudentResult(
      student,
      exam,
      examSubjects,
      marksByStudent.get(String(student._id)) || new Map(),
    );

  const studentId = String(rawStudentId || '').trim();
  if (studentId) {
    const student = await getStudent(studentId);
    if (!student) {
      throw new ApiError(404, 'Student not found');
    }
    if (String(student.class) !== className) {
      throw new ApiError(400, 'Student does not belong to the selected class');
    }
    if (String(student.academicYear) !== String(academicYear)) {
      throw new ApiError(400, 'Student is not enrolled for the selected academic year');
    }

    return {
      mode: 'individual',
      result: buildForStudent(student),
    };
  }

  const students = await Student.find({
    class: className,
    academicYear: String(academicYear),
    status: 'Active',
  })
    .sort({ studentId: 1 })
    .select('studentId fullName fatherName studentImage class academicYear')
    .lean();

  if (students.length === 0) {
    throw new ApiError(404, 'No active students found in the selected class for the selected academic year');
  }

  return {
    mode: 'class',
    results: students.map(buildForStudent),
    totalStudents: students.length,
  };
};

export default {
  getResult,
};