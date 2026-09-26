import api from '../../api/axios';

/**
 * Teacher My Results service - wired to teacher-scoped endpoints:
 *   GET  /teacher/marks-entry/exams          (my exams + assigned classes/subjects - source for filters)
 *   GET  /teacher/marks-entry/exam-subjects  (my exam subject configs - subject options)
 *   GET  /teacher/my-results                 (computed results from saved marks, teacher-scoped)
 *
 * Results are computed server-side from the existing Mark collection (source of truth)
 * using the same admin result architecture (GRADE_SYSTEM, buildStudentResult). No dummy data.
 */

const getScopes = async () => {
  const { data } = await api.get('/teacher/marks-entry/exams');

  const result = data?.data || {};

  return {
    exams: (result.exams || []).map((exam) => ({
      examId: exam._id || exam.examId,
      name: exam.name || '',
      type: exam.type || '',
      academicYear: exam.academicYear || '',
      classes: exam.classes || [],
    })),
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

const getExamSubjectsConfig = async ({ examId, className, subjectId } = {}) => {
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
    subjects: (result.subjects || []).map((config) => ({
      subjectId: config.subjectId,
      subjectName: config.subjectName || '',
      subjectCode: config.subjectCode || '',
      totalMarks: config.totalMarks ?? 0,
      passingMarks: config.passingMarks ?? 0,
    })),
  };
};

const searchResults = async ({ examId, className, subjectId, academicYear } = {}) => {
  const params = {};
  if (examId) params.examId = examId;
  if (className) params.className = className;
  if (subjectId) params.subjectId = subjectId;
  if (academicYear) params.academicYear = academicYear;

  const { data } = await api.get('/teacher/my-results', { params });
  const result = data?.data || {};

  return {
    mode: result.mode || 'class',
    className: result.className || '',
    academicYear: result.academicYear || '',
    exam: result.exam || {},
    results: result.results || [],
    totalStudents: result.totalStudents ?? result.results?.length ?? 0,
  };
};

const myResultsService = {
  getScopes,
  getExamSubjectsConfig,
  searchResults,
};

export default myResultsService;