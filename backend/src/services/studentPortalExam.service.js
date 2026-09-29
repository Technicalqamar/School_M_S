import mongoose from 'mongoose';
import Exam from '../models/exam.model.js';
import ExamSubject from '../models/examSubject.model.js';
import ExamSchedule from '../models/examSchedule.model.js';
import Mark from '../models/mark.model.js';
import { ApiError } from '../utils/apiError.js';
import studentSession from './studentSession.service.js';

// Student Portal Examination — READ-ONLY backend.
//
// A logged-in student sees ONLY their own examination data, sourced in real
// time from the existing `exams`, `examsubjects`, `examschedules` and `marks`
// collections (the exact records the Admin Examination / Teacher Mark Entry
// modules write). Nothing here creates, updates or deletes any document — a
// student can never add, edit or remove an exam, subject, schedule, mark or
// admit card.
//
//   - The student is always resolved from the authenticated session; any query
//     parameter that could target another student's records (studentId,
//     classId, class, ...) is denied.
//   - Only exams of the two official terms — Mid Term and Final Term — are
//     ever exposed, and only for the student's actual class and the academic
//     year resolved from the student's enrolment (central/default school
//     settings as fallback). Historical years are only presented when real
//     records exist for them.
//   - The marksheet mirrors the existing Admin Result computation exactly
//     (same grading bands, percentage rounding and Pending/Passed/Failed
//     logic) so the student sees the same figures the school computes.
//   - The admit card reuses the existing Exam Schedule data exactly as the
//     Admin Admit Card module presents it.

const STUDENT_EXAM_TYPES = ['Mid Term', 'Final Term'];

const { resolveStudentForRequest, resolveAcademicYear, assertActiveStudent } = studentSession;

// Identical grading constants/labels to the existing Admin Result service so
// the portal marksheet matches the school's own figures.
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

// Query parameters that could be used to reach another student's record.
const TAMPERING_PARAMS = ['studentId', 'student', 'classId', 'class', 'className'];

const denyScopingParams = (params) => {
  const detected = TAMPERING_PARAMS.filter(
    (key) => params[key] !== undefined && params[key] !== null && String(params[key]).trim() !== '',
  );
  if (detected.length > 0) {
    throw new ApiError(
      403,
      'Student examination requests are scoped automatically to your own account; this parameter is not allowed',
    );
  }
};

// Exams are always restricted to the session student's own class + year + the
// official Mid Term / Final Term types, so a foreign or malformed examId can
// never surface another class's data.
const getScopedExamFilter = (student, academicYear) => ({
  academicYear,
  classes: student.class,
  type: { $in: STUDENT_EXAM_TYPES },
  status: 'Active',
});

const findScopedExam = async (student, academicYear, rawExamId) => {
  const examId = String(rawExamId || '').trim();
  if (!examId) {
    throw new ApiError(400, 'Exam id is required');
  }
  if (!mongoose.Types.ObjectId.isValid(examId)) {
    throw new ApiError(400, 'Invalid exam id');
  }

  const exam = await Exam.findOne(getScopedExamFilter(student, academicYear)).and([{ _id: examId }]).lean();
  if (!exam) {
    throw new ApiError(404, 'Exam not found for your class and academic year');
  }
  return exam;
};

const buildStudentBrief = (student) => ({
  _id: student._id,
  studentId: student.studentId,
  fullName: student.fullName,
  className: student.class,
  academicYear: String(student.academicYear),
});

const buildExamDetail = (exam, examSubjects) => {
  const totalMarks = examSubjects.reduce((sum, es) => sum + es.totalMarks, 0);

  return {
    _id: exam._id,
    name: exam.name,
    type: exam.type,
    academicYear: String(exam.academicYear),
    startDate: exam.startDate,
    endDate: exam.endDate,
    description: exam.description || '',
    status: exam.status,
    totalSubjects: examSubjects.length,
    totalMarks,
    subjects: examSubjects.map((es) => ({
      subjectCode: es.subjectId?.subjectCode || '',
      subjectName: es.subjectId?.subjectName || '-',
      totalMarks: es.totalMarks,
      passingMarks: es.passingMarks,
    })),
  };
};

// ---------------------------------------------------------------------------
// 1) Exam list / details — the exams configured for the student's class & year.
// ---------------------------------------------------------------------------
const getMyExams = async (user, context, params = {}) => {
  denyScopingParams(params);

  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);
  const academicYear = await resolveAcademicYear(params.academicYear, student.academicYear);

  if (params.examId !== undefined && params.examId !== null && String(params.examId).trim() !== '') {
    const exam = await findScopedExam(student, academicYear, params.examId);

    const examSubjects = await ExamSubject.find({
      examId: exam._id,
      className: student.class,
      academicYear,
      status: 'Active',
    })
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ subjectId: 1 })
      .lean();

    return {
      student: buildStudentBrief(student),
      academicYear,
      exam: buildExamDetail(exam, examSubjects),
    };
  }

  const exams = await Exam.find(getScopedExamFilter(student, academicYear))
    .sort({ startDate: 1, createdAt: 1 })
    .lean();

  const examIds = exams.map((e) => e._id);
  const examSubjects = examIds.length
    ? await ExamSubject.find({
        examId: { $in: examIds },
        className: student.class,
        academicYear,
        status: 'Active',
      })
        .populate('subjectId', 'subjectName subjectCode')
        .lean()
    : [];

  const subjectsByExam = new Map();
  examSubjects.forEach((es) => {
    const key = String(es.examId);
    if (!subjectsByExam.has(key)) subjectsByExam.set(key, []);
    subjectsByExam.get(key).push(es);
  });

  return {
    student: buildStudentBrief(student),
    academicYear,
    exams: exams.map((exam) => buildExamDetail(exam, subjectsByExam.get(String(exam._id)) || [])),
  };
};

// ---------------------------------------------------------------------------
// 2) Exam Schedule / Date Sheet for the student's class.
// ---------------------------------------------------------------------------
const getMyExamSchedule = async (user, context, params = {}) => {
  denyScopingParams(params);

  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);
  const academicYear = await resolveAcademicYear(params.academicYear, student.academicYear);

  let exams = await Exam.find(getScopedExamFilter(student, academicYear)).sort({ startDate: 1 }).lean();

  if (params.examId !== undefined && params.examId !== null && String(params.examId).trim() !== '') {
    exams = [await findScopedExam(student, academicYear, params.examId)];
  }

  const examIds = exams.map((e) => e._id);
  const schedules = examIds.length
    ? await ExamSchedule.find({
        examId: { $in: examIds },
        className: student.class,
        academicYear,
        status: 'Active',
      })
        .populate('subjectId', 'subjectName subjectCode')
        .sort({ examDate: 1, startTime: 1 })
        .lean()
    : [];

  const schedulesByExam = new Map();
  schedules.forEach((schedule) => {
    const key = String(schedule.examId);
    if (!schedulesByExam.has(key)) schedulesByExam.set(key, []);
    schedulesByExam.get(key).push(schedule);
  });

  return {
    student: buildStudentBrief(student),
    academicYear,
    exams: exams.map((exam) => ({
      exam: {
        _id: exam._id,
        name: exam.name,
        type: exam.type,
        academicYear: String(exam.academicYear),
        startDate: exam.startDate,
        endDate: exam.endDate,
      },
      schedules: (schedulesByExam.get(String(exam._id)) || []).map((schedule) => ({
        subjectName: schedule.subjectId?.subjectName || '-',
        subjectCode: schedule.subjectId?.subjectCode || '',
        examDate: schedule.examDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room || '',
        notes: schedule.notes || '',
      })),
    })),
  };
};

// ---------------------------------------------------------------------------
// 3) Result / Marksheet — computed exactly like the existing Admin Result.
// ---------------------------------------------------------------------------
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
  const allEntered = subjectResults.length > 0 ? subjectResults.every((s) => s.entered) : false;
  const allPassed = subjectResults.every((s) => !s.entered || s.passed);
  const percentage = allEntered ? Number(((obtainedMarksAll / totalMarks) * 100).toFixed(1)) : null;

  let status;
  if (subjectResults.length === 0 || !allEntered) {
    status = 'Pending';
  } else if (allPassed) {
    status = 'Passed';
  } else {
    status = 'Failed';
  }

  return {
    exam: {
      _id: exam._id,
      name: exam.name,
      type: exam.type,
      academicYear: String(exam.academicYear),
    },
    subjectResults,
    totalMarks,
    obtainedMarks: allEntered ? obtainedMarksAll : null,
    percentage,
    grade: percentage !== null ? getGrade(percentage) : '-',
    status,
    allEntered,
  };
};

const getMyResults = async (user, context, params = {}) => {
  denyScopingParams(params);

  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);
  const academicYear = await resolveAcademicYear(params.academicYear, student.academicYear);

  let exams = await Exam.find(getScopedExamFilter(student, academicYear)).sort({ startDate: 1 }).lean();

  if (params.examId !== undefined && params.examId !== null && String(params.examId).trim() !== '') {
    exams = [await findScopedExam(student, academicYear, params.examId)];
  }

  // Only this student's own marks are ever queried.
  const results = [];
  for (const exam of exams) {
    const [examSubjects, marks] = await Promise.all([
      ExamSubject.find({
        examId: exam._id,
        className: student.class,
        academicYear,
        status: 'Active',
      })
        .populate('subjectId', 'subjectName subjectCode')
        .sort({ subjectId: 1 })
        .lean(),
      Mark.find({ examId: exam._id, studentId: student._id }).lean(),
    ]);

    const marksBySubject = new Map(marks.map((mark) => [String(mark.subjectId), mark]));
    results.push(buildStudentResult(student, exam, examSubjects, marksBySubject));
  }

  return {
    student: buildStudentBrief(student),
    academicYear,
    results,
  };
};

// ---------------------------------------------------------------------------
// 4) Admit Card — reuses the existing published Exam Schedule data.
// ---------------------------------------------------------------------------
const buildStudentIdentity = (student) => ({
  studentId: student.studentId,
  fullName: student.fullName,
  fatherName: student.fatherName || '',
  studentImage: student.studentImage || '',
  className: student.class,
  academicYear: String(student.academicYear),
});

const getMyAdmitCard = async (user, context, params = {}) => {
  denyScopingParams(params);

  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);
  const academicYear = await resolveAcademicYear(params.academicYear, student.academicYear);

  let exam;
  if (params.examId !== undefined && params.examId !== null && String(params.examId).trim() !== '') {
    exam = await findScopedExam(student, academicYear, params.examId);
  } else {
    const exams = await Exam.find(getScopedExamFilter(student, academicYear)).sort({ startDate: 1 }).lean();
    // Default to the earliest exam whose date sheet is already published.
    for (const candidate of exams) {
      const published = await ExamSchedule.exists({
        examId: candidate._id,
        className: student.class,
        academicYear,
        status: 'Active',
      });
      if (published) {
        exam = candidate;
        break;
      }
    }
    if (!exam) {
      throw new ApiError(404, 'No published exam schedule is available for your class yet');
    }
  }

  const [examSubjects, schedules] = await Promise.all([
    ExamSubject.find({
      examId: exam._id,
      className: student.class,
      academicYear,
      status: 'Active',
    })
      .populate('subjectId', 'subjectName')
      .sort({ subjectId: 1 })
      .lean(),
    ExamSchedule.find({
      examId: exam._id,
      className: student.class,
      academicYear,
      status: 'Active',
    })
      .populate('subjectId', 'subjectName')
      .sort({ examDate: 1, startTime: 1 })
      .lean(),
  ]);

  const configuredSubjectIds = new Set(
    examSubjects.map((es) => (es.subjectId ? String(es.subjectId._id) : '')).filter((id) => id !== ''),
  );
  const publishedSchedules = schedules.filter(
    (s) => s.subjectId && configuredSubjectIds.has(String(s.subjectId._id)),
  );

  if (publishedSchedules.length === 0) {
    throw new ApiError(404, 'No exam schedule has been published for this exam and class yet');
  }

  return {
    student: buildStudentBrief(student),
    academicYear,
    admitCard: {
      student: buildStudentIdentity(student),
      exam: {
        _id: exam._id,
        name: exam.name,
        type: exam.type,
        academicYear: String(exam.academicYear),
      },
      className: student.class,
      academicYear,
      examSubjects: examSubjects.map((es) => ({
        subjectName: es.subjectId?.subjectName || '-',
        totalMarks: es.totalMarks,
        passingMarks: es.passingMarks,
      })),
      schedules: publishedSchedules.map((s) => ({
        subjectName: s.subjectId?.subjectName || '-',
        examDate: s.examDate,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room || '',
        notes: s.notes || '',
      })),
    },
  };
};

export default {
  getMyExams,
  getMyExamSchedule,
  getMyResults,
  getMyAdmitCard,
};