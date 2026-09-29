import api from '../../api/axios';

/**
 * Student Examination service.
 *
 * Backed by the protected student endpoints built in Step 6:
 *   GET /api/v1/student/exam/exams      → own exams for the class & year
 *   GET /api/v1/student/exam/schedule   → date sheet for the class
 *   GET /api/v1/student/exam/results    → own marksheet (real Teacher Mark data)
 *   GET /api/v1/student/exam/admit-card → admit card from the published schedule
 *
 * Everything is READ-ONLY and the server derives the student from the
 * authenticated session, so there are no student/class/teacher selectors and
 * no create/edit/delete/mark-entry capability here.
 *
 * The exam computation (grades, Passed/Failed, percentages) happens on the
 * server (mirroring the Admin Result module); this client only maps the real
 * response payloads into the shapes the page renders.
 */

const EMPTY_DASH = '—';

const mapStudent = (s) =>
  s
    ? {
        _id: s._id || '',
        studentId: s.studentId || '',
        fullName: s.fullName || '',
        className: s.className || '',
        academicYear: s.academicYear || '',
      }
    : null;

const mapSubject = (es) => ({
  subjectCode: es.subjectCode || '',
  subjectName: es.subjectName || EMPTY_DASH,
  totalMarks: es.totalMarks ?? null,
  passingMarks: es.passingMarks ?? null,
});

const mapExam = (e) => ({
  _id: e._id || '',
  name: e.name || '',
  type: e.type || '',
  academicYear: e.academicYear || '',
  startDate: e.startDate || '',
  endDate: e.endDate || '',
  description: e.description || '',
  status: e.status || '',
  totalSubjects: e.totalSubjects ?? 0,
  totalMarks: e.totalMarks ?? 0,
  subjects: (e.subjects || []).map(mapSubject),
});

const mapSchedule = (s) => ({
  subjectName: s.subjectName || EMPTY_DASH,
  subjectCode: s.subjectCode || '',
  examDate: s.examDate || '',
  startTime: s.startTime || '',
  endTime: s.endTime || '',
  room: s.room || '',
  notes: s.notes || '',
});

const mapMarkSubject = (r) => ({
  subjectName: r.subjectName || EMPTY_DASH,
  subjectCode: r.subjectCode || '',
  totalMarks: r.totalMarks ?? null,
  passingMarks: r.passingMarks ?? null,
  obtainedMarks: r.obtainedMarks ?? null,
  percentage: r.percentage ?? null,
  grade: r.grade || '-',
  passed: Boolean(r.passed),
  entered: Boolean(r.entered),
});

const mapResult = (r) => ({
  exam: {
    _id: r.exam?._id || '',
    name: r.exam?.name || '',
    type: r.exam?.type || '',
    academicYear: r.exam?.academicYear || '',
  },
  subjectResults: (r.subjectResults || []).map(mapMarkSubject),
  totalMarks: r.totalMarks ?? 0,
  obtainedMarks: r.obtainedMarks ?? null,
  percentage: r.percentage ?? null,
  grade: r.grade || '-',
  status: r.status || 'Pending',
  allEntered: Boolean(r.allEntered),
});

const mapAdmitCard = (a) =>
  a
    ? {
        student: {
          studentId: a.student?.studentId || '',
          fullName: a.student?.fullName || '',
          fatherName: a.student?.fatherName || '',
          studentImage: a.student?.studentImage || '',
          className: a.student?.className || '',
          academicYear: a.student?.academicYear || '',
        },
        exam: {
          _id: a.exam?._id || '',
          name: a.exam?.name || '',
          type: a.exam?.type || '',
          academicYear: a.exam?.academicYear || '',
        },
        className: a.className || '',
        academicYear: a.academicYear || '',
        examSubjects: (a.examSubjects || []).map((es) => ({
          subjectName: es.subjectName || EMPTY_DASH,
          totalMarks: es.totalMarks ?? null,
          passingMarks: es.passingMarks ?? null,
        })),
        schedules: (a.schedules || []).map(mapSchedule),
      }
    : null;

/** Fetches the logged-in student's exams for their class and the central year. */
const getExams = async (params = {}) => {
  const response = await api.get('/student/exam/exams', { params });
  const data = response.data?.data || {};

  return {
    student: mapStudent(data.student),
    academicYear: data.academicYear || '',
    exams: (data.exams || []).map(mapExam),
    exam: data.exam ? mapExam(data.exam) : null,
  };
};

/** Fetches the date sheet for the student's class (optionally one exam). */
const getExamSchedule = async (params = {}) => {
  const response = await api.get('/student/exam/schedule', { params });
  const data = response.data?.data || {};

  return {
    student: mapStudent(data.student),
    academicYear: data.academicYear || '',
    exams: (data.exams || []).map((entry) => ({
      exam: {
        _id: entry.exam?._id || '',
        name: entry.exam?.name || '',
        type: entry.exam?.type || '',
        academicYear: entry.exam?.academicYear || '',
        startDate: entry.exam?.startDate || '',
        endDate: entry.exam?.endDate || '',
      },
      schedules: (entry.schedules || []).map(mapSchedule),
    })),
  };
};

/** Fetches the logged-in student's marksheet(s) from real Teacher Mark data. */
const getResults = async (params = {}) => {
  const response = await api.get('/student/exam/results', { params });
  const data = response.data?.data || {};

  return {
    student: mapStudent(data.student),
    academicYear: data.academicYear || '',
    results: (data.results || []).map(mapResult),
  };
};

/** Fetches the admit card for the logged-in student from the published schedule. */
const getAdmitCard = async (params = {}) => {
  const response = await api.get('/student/exam/admit-card', { params });
  const data = response.data?.data || {};

  return {
    student: mapStudent(data.student),
    academicYear: data.academicYear || '',
    admitCard: mapAdmitCard(data.admitCard),
  };
};

export default { getExams, getExamSchedule, getResults, getAdmitCard };