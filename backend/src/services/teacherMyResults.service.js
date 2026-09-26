import mongoose from 'mongoose';
import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import Class from '../models/class.model.js';
import Exam from '../models/exam.model.js';
import ExamSubject from '../models/examSubject.model.js';
import Mark from '../models/mark.model.js';
import Student from '../models/student.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import { getTeacherClassScope } from './teacherScope.service.js';

const TEACHER_EXAM_TYPES = ['Mid Term', 'Final Term'];

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

const resolveTeacherProfile = async (user) => {
  if (user?.referenceId && user.referenceModel === 'Teacher') {
    const teacher = await Teacher.findById(user.referenceId).lean();
    if (!teacher) {
      throw new ApiError(404, 'Linked teacher profile not found');
    }
    return teacher;
  }

  if (user?.role === 'teacher') {
    const teacher = await Admin.findById(user._id).lean();
    if (!teacher) {
      throw new ApiError(404, 'Teacher profile not found');
    }
    return teacher;
  }

  throw new ApiError(403, 'Only teachers can access my results');
};

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear);
  }

  return String(new Date().getFullYear());
};

const classMembershipFilter = (className, academicYear, subjectId) => {
  const membership = {
    $or: [
      { class: className, academicYear, enrollments: { $exists: false } },
      { class: className, academicYear, enrollments: { $size: 0 } },
      {
        enrollments: {
          $elemMatch: {
            academicYear,
            class: className,
            status: { $in: ['Active', 'Historical'] },
          },
        },
      },
    ],
  };

  if (subjectId) {
    membership.$or = membership.$or.map((entry) => ({
      ...entry,
      assignedSubjects: { $in: [subjectId] },
    }));
  }

  return membership;
};

const resolveAssignedContext = async (user, { className, subjectId }) => {
  if (!className) {
    throw new ApiError(400, 'Class is required');
  }
  if (!subjectId) {
    throw new ApiError(400, 'Subject is required');
  }

  const teacher = await resolveTeacherProfile(user);

  if (teacher.status !== 'Active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }

  const academicYear = await getCurrentAcademicYear();

  const cls = await Class.findOne({
    className,
    academicYear,
    status: 'Active',
    isDeleted: { $ne: true },
  })
    .populate({ path: 'assignedSubjects', select: 'subjectName subjectCode' })
    .lean();

  if (!cls) {
    throw new ApiError(404, 'Class not found for the current academic year');
  }

  const classSubjectIds = (cls.assignedSubjects || []).map((s) => s._id.toString());
  const classSubjectSet = new Set(classSubjectIds);

  if (!classSubjectSet.has(String(subjectId))) {
    throw new ApiError(403, 'This subject is not assigned to the selected class.');
  }

  const { teacherSubjectIds, teacherSubjectSet } = await getTeacherClassScope(teacher, cls);

  if (!teacherSubjectSet.has(String(subjectId))) {
    throw new ApiError(403, 'You are not assigned to this subject for this class.');
  }

  return {
    teacher,
    teacherSubjectIds,
    teacherSubjectSet,
    className,
    classSubjectIds,
    classSubjectSet,
    academicYear,
  };
};

const buildSubjectResult = (config, mark) => {
  const subjectId = String(config.subjectId?._id || config.subjectId);
  const totalMarks = mark && typeof mark.totalMarks === 'number' ? mark.totalMarks : config.totalMarks;
  const obtainedMarks = mark ? mark.obtainedMarks : null;
  const entered = Boolean(mark);
  const percentage = entered ? Number(((obtainedMarks / totalMarks) * 100).toFixed(1)) : null;

  return {
    subjectId,
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
  const allEntered = subjectResults.length > 0 && subjectResults.every((s) => s.entered);
  const allPassed = subjectResults.every((s) => !s.entered || s.passed);
  const percentage = allEntered ? Number(((obtainedMarksAll / totalMarks) * 100).toFixed(1)) : null;

  let status;
  if (subjectResults.length === 0) {
    status = 'Pending';
  } else if (!allEntered) {
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

const getMyResults = async (user, { academicYear, examId, className, subjectId } = {}) => {
  const context = await resolveAssignedContext(user, { className, subjectId });

  if (!mongoose.Types.ObjectId.isValid(examId)) {
    throw new ApiError(400, 'Invalid exam id');
  }

  const year = (() => {
    if (academicYear === undefined || academicYear === null || String(academicYear).trim() === '') {
      return context.academicYear;
    }
    const trimmed = String(academicYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(trimmed)) {
      throw new ApiError(400, 'Academic year must be a valid year (e.g. 2025)');
    }
    return trimmed;
  })();

  const exam = await Exam.findOne({
    _id: examId,
    academicYear: year,
    status: 'Active',
    type: { $in: TEACHER_EXAM_TYPES },
  })
    .select('name type academicYear classes status')
    .lean();

  if (!exam) {
    throw new ApiError(404, 'Exam not found for the selected academic year');
  }

  if (!(exam.classes || []).includes(className)) {
    throw new ApiError(400, 'Class is not configured for this exam');
  }

  const [configs, marks, students] = await Promise.all([
    ExamSubject.find({
      examId,
      className,
      academicYear: year,
      status: 'Active',
      subjectId: String(subjectId),
    })
      .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
      .select('subjectId totalMarks passingMarks status')
      .sort({ createdAt: 1 })
      .lean(),
    Mark.find({
      examId,
      className,
      academicYear: year,
      subjectId: String(subjectId),
    })
      .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
      .select('studentId subjectId obtainedMarks totalMarks remarks status')
      .lean(),
    Student.find(classMembershipFilter(className, year))
      .select('studentId fullName fatherName studentImage class academicYear status')
      .sort({ fullName: 1 })
      .lean(),
  ]);

  const examSubjects = (configs || []).map((c) => ({
    subjectId: c.subjectId?._id || c.subjectId,
    subjectName: c.subjectId?.subjectName || '-',
    subjectCode: c.subjectId?.subjectCode || '',
    totalMarks: c.totalMarks,
    passingMarks: c.passingMarks,
    status: c.status,
  }));

  const marksByStudent = new Map();
  (marks || []).forEach((mark) => {
    const studentKey = String(mark.studentId);
    if (!marksByStudent.has(studentKey)) {
      marksByStudent.set(studentKey, new Map());
    }
    marksByStudent
      .get(studentKey)
      .set(String(mark.subjectId?._id || mark.subjectId), {
        obtainedMarks: mark.obtainedMarks,
        totalMarks: mark.totalMarks,
      });
  });

  const results = (students || []).map((student) =>
    buildStudentResult(
      student,
      exam,
      examSubjects,
      marksByStudent.get(String(student._id)) || new Map(),
    ),
  );

  return {
    mode: 'class',
    className,
    academicYear: year,
    exam: {
      name: exam.name,
      type: exam.type,
      academicYear: String(exam.academicYear),
    },
    results,
    totalStudents: results.length,
  };
};

export default {
  getMyResults,
};