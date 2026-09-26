import api from '../../api/axios';

/**
 * Teacher Marks Entry service �?" wired to the protected teacher-scoped endpoints:
 *   GET    /teacher/marks-entry/exams              (my exams - Mid/Final Term, Active, current year)
 *   GET    /teacher/marks-entry/exam-subjects      (my exam subject configs - my assigned subjects only)
 *   GET    /teacher/marks-entry/students           (my class students - my assigned class+subject only)
 *   GET    /teacher/marks-entry/marks              (my existing marks for a scope)
 *   POST   /teacher/marks-entry/bulk               (bulk save/update my marks)
 *
 * All endpoints enforce the logged-in teacher's assigned class + subject context
 * server-side (403 for non-assigned scopes). No dummy data is used anywhere.
 */

const flattenExams = (exams = []) =>
  (exams || []).map((exam) => ({
    _id: exam._id || exam.examId,
    examId: exam._id || exam.examId,
    name: exam.name || '',
    type: exam.type || '',
    academicYear: exam.academicYear || '',
    classes: exam.classes || [],
    status: exam.status || 'Active',
  }));

const getExams = async () => {
  const { data } = await api.get('/teacher/marks-entry/exams');

  const result = data?.data || {};

  return {
    exams: flattenExams(result.exams || []),
    classes: (result.classes || []).map((cls) => ({
      classId: cls.classId,
      className: cls.className,
      academicYear: cls.academicYear,
      subjects: (cls.subjects || []).map((s) => ({
        id: s.id,
        subjectName: s.subjectName,
        subjectCode: s.subjectCode,
      })),
    })),
  };
};

const flattenExamSubjects = (configs = []) =>
  (configs || []).map((config) => ({
    subjectId: config.subjectId,
    subjectName: config.subjectName || '',
    subjectCode: config.subjectCode || '',
    totalMarks: config.totalMarks ?? 0,
    passingMarks: config.passingMarks ?? 0,
  }));

const getExamSubjects = async ({ examId, className, subjectId } = {}) => {
  const params = {};

  if (examId) params.examId = examId;
  if (className) params.className = className;
  if (subjectId) params.subjectId = subjectId;

  const { data } = await api.get('/teacher/marks-entry/exam-subjects', { params });
  const result = data?.data || {};

  return {
    exam: result.exam || {},
    className: result.className || '',
    academicYear: result.academicYear || '',
    subjects: flattenExamSubjects(result.subjects || []),
  };
};

const flattenStudents = (students = []) =>
  (students || []).map((student) => ({
    _id: student._id,
    studentId: student.studentId || '',
    fullName: student.fullName || '',
    fatherName: student.fatherName || '',
    admissionNumber: student.admissionNumber || '',
    className: student.className || '',
  }));

const getClassStudents = async ({ className, subjectId, search } = {}) => {
  const params = {};

  if (className) params.className = className;
  if (subjectId) params.subjectId = subjectId;
  if (search) params.search = search;

  const { data } = await api.get('/teacher/marks-entry/students', { params });
  const result = data?.data || {};

  return {
    className: result.className || '',
    academicYear: result.academicYear || '',
    students: flattenStudents(result.students || []),
  };
};

const flattenMarks = (marks = []) =>
  (marks || []).map((mark) => ({
    _id: mark._id,
    studentId: mark.studentId,
    studentNumber: mark.studentNumber || mark.studentId?.studentId || '',
    fullName: mark.fullName || '',
    obtainedMarks: mark.obtainedMarks,
    totalMarks: mark.totalMarks,
    remarks: mark.remarks || '',
  }));

const getMarks = async ({ examId, subjectId, className, academicYear } = {}) => {
  const params = {};

  if (examId) params.examId = examId;
  if (subjectId) params.subjectId = subjectId;
  if (className) params.className = className;
  if (academicYear) params.academicYear = academicYear;

  const { data } = await api.get('/teacher/marks-entry/marks', { params });
  const result = data?.data || {};

  return {
    marks: flattenMarks(result.marks || []),
  };
};

const bulkSaveMarks = async ({ examId, subjectId, className, academicYear, entries = [] } = {}) => {
  const { data } = await api.post('/teacher/marks-entry/bulk', {
    examId,
    subjectId,
    className,
    academicYear,
    entries,
  });

  const result = data?.data || {};

  return {
    savedCount: result.savedCount ?? (result.data?.savedCount ?? 0),
    updatedCount: result.updatedCount ?? (result.data?.updatedCount ?? 0),
  };
};

const teacherMarksEntryService = {
  getExams,
  getExamSubjects,
  getClassStudents,
  getMarks,
  bulkSaveMarks,
};

export default teacherMarksEntryService;
