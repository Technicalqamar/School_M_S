import mongoose from 'mongoose';
import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import Class from '../models/class.model.js';
import Exam from '../models/exam.model.js';
import ExamSubject from '../models/examSubject.model.js';
import Subject from '../models/subject.model.js';
import Student from '../models/student.model.js';
import Mark from '../models/mark.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import markService from './mark.service.js';
import { getTeacherScope, getTeacherClassScope } from './teacherScope.service.js';

const TEACHER_EXAM_TYPES = ['Mid Term', 'Final Term'];

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

  throw new ApiError(403, 'Only teachers can access mark entry');
};

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(String(settings.currentAcademicYear))) {
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

  const { teacherSubjectIds, teacherSubjectSet } = await getTeacherClassScope(teacher, cls);

  if (subjectId) {
    if (!classSubjectSet.has(String(subjectId))) {
      throw new ApiError(403, 'This subject is not assigned to the selected class.');
    }

    if (!teacherSubjectSet.has(String(subjectId))) {
      throw new ApiError(403, 'You are not assigned to this subject for this class.');
    }
  } else if (teacherSubjectIds.length === 0) {
    throw new ApiError(403, 'You are not assigned to this class.');
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

const getMyExams = async (user) => {
  const teacher = await resolveTeacherProfile(user);

  if (teacher.status !== 'Active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }

  const academicYear = await getCurrentAcademicYear();

  const scope = await getTeacherScope(teacher, academicYear);

  if (scope.length === 0) {
    return { exams: [], classes: [] };
  }

  const classNames = (scope || []).map((c) => c.className);

  const exams = await Exam.find({
    academicYear,
    status: 'Active',
    type: { $in: TEACHER_EXAM_TYPES },
    classes: { $in: classNames },
  })
    .select('name type academicYear classes status')
    .sort({ createdAt: -1 })
    .lean();

  return {
    exams: (exams || []).map((exam) => ({
      _id: exam._id,
      name: exam.name,
      type: exam.type,
      academicYear: exam.academicYear,
      classes: exam.classes || [],
      status: exam.status,
    })),
    classes: (scope || []).map((cls) => ({
      classId: cls.classId,
      className: cls.className,
      academicYear: cls.academicYear,
      subjects: cls.subjects,
    })),
  };
};

const getMyExamSubjects = async (user, { examId, className, subjectId }) => {
  const context = await resolveAssignedContext(user, { className, subjectId });

  if (!mongoose.Types.ObjectId.isValid(examId)) {
    throw new ApiError(400, 'Invalid exam id');
  }

  const exam = await Exam.findOne({
    _id: examId,
    academicYear: context.academicYear,
    status: 'Active',
    type: { $in: TEACHER_EXAM_TYPES },
  })
    .select('name type academicYear classes status')
    .lean();

  if (!exam) {
    throw new ApiError(404, 'Exam not found for the current academic year');
  }

  if (!(exam.classes || []).includes(className)) {
    throw new ApiError(400, 'Class is not configured for this exam');
  }

  const assignedSubjectIds = context.classSubjectIds.filter((id) => context.teacherSubjectSet.has(id));

  const [subjects, configs] = await Promise.all([
    Subject.find({ _id: { $in: assignedSubjectIds } }).select('subjectName subjectCode status').lean(),
    ExamSubject.find({
      examId,
      className,
      academicYear: context.academicYear,
      status: 'Active',
      subjectId: { $in: assignedSubjectIds },
    })
      .select('subjectId totalMarks passingMarks status')
      .lean(),
  ]);

  const configBySubjectId = new Map();
  for (const config of configs || []) {
    configBySubjectId.set(String(config.subjectId), config);
  }

  return {
    exam: {
      examId: exam._id,
      name: exam.name,
      type: exam.type,
      academicYear: exam.academicYear,
    },
    className,
    academicYear: context.academicYear,
    subjects: (subjects || [])
      .filter((s) => (subjectId ? String(s._id) === String(subjectId) : true))
      .map((s) => {
        const config = configBySubjectId.get(String(s._id));
        return {
          subjectId: s._id,
          subjectName: s.subjectName,
          subjectCode: s.subjectCode || '',
          totalMarks: config ? config.totalMarks : null,
          passingMarks: config ? config.passingMarks : null,
          status: s.status,
          examConfigured: Boolean(config),
        };
      }),
  };
};

const getMyClassStudents = async (user, { className, subjectId, search }) => {
  const context = await resolveAssignedContext(user, { className, subjectId });

  const filter = classMembershipFilter(className, context.academicYear);

  const andConditions = [filter];

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    andConditions.push({ $or: [{ studentId: regex }, { fullName: regex }] });
  }

  const students = await Student.find({ $and: andConditions })
    .select('studentId fullName fatherName admissionNumber class academicYear status')
    .sort({ fullName: 1 })
    .lean();

  return {
    className,
    academicYear: context.academicYear,
    students: (students || []).map((s) => ({
      _id: s._id,
      studentId: s.studentId,
      fullName: s.fullName,
      fatherName: s.fatherName,
      admissionNumber: s.admissionNumber,
      className: s.class,
      status: s.status,
    })),
  };
};

const getMyMarks = async (user, { examId, subjectId, className, academicYear, page, limit }) => {
  const context = await resolveAssignedContext(user, { className, subjectId });

  if (!mongoose.Types.ObjectId.isValid(examId)) {
    throw new ApiError(400, 'Invalid exam id');
  }

  const filter = {
    examId,
    subjectId: String(subjectId),
    className,
    academicYear: academicYear || context.academicYear,
  };

  const marks = await Mark.find(filter)
    .populate({ path: 'studentId', select: 'studentId fullName fatherName admissionNumber class academicYear' })
    .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
    .populate({ path: 'examId', select: 'name type academicYear' })
    .sort({ 'studentId.fullName': 1 })
    .lean();

  return {
    className,
    subjectId: String(subjectId),
    academicYear: academicYear || context.academicYear,
    marks: (marks || []).map((m) => ({
      _id: m._id,
      studentId: m.studentId?._id,
      studentNumber: m.studentId?.studentId || '',
      fullName: m.studentId?.fullName || '',
      fatherName: m.studentId?.fatherName || '',
      obtainedMarks: m.obtainedMarks,
      totalMarks: m.totalMarks,
      remarks: m.remarks || '',
      status: m.status || 'Entered',
    })),
  };
};

const bulkSaveMarks = async (user, data) => {
  const { examId, subjectId, className, academicYear, entries = [] } = data || {};

  await resolveAssignedContext(user, { className, subjectId });

  return markService.bulkSaveMarks({
    examId,
    subjectId,
    className,
    academicYear,
    entries,
  });
};

export default {
  getMyExams,
  getMyExamSubjects,
  getMyClassStudents,
  getMyMarks,
  bulkSaveMarks,
};
