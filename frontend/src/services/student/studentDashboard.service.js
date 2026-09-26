import api from '../../api/axios';

/**
 * Student Dashboard service — the single integration point for the Student
 * Dashboard. Resolves live data from the protected GET /student/dashboard
 * endpoint, scoped to the logged-in student's own profile, class, fee status,
 * homework and upcoming examinations. No fabricated data.
 */

export const STUDENT_DASHBOARD_EMPTY_DATA = {
  student: {},
  class: null,
  academicYear: '',
  fee: {
    academicYear: '',
    structureAvailable: false,
    monthlyFee: null,
    admissionFee: null,
    examFee: null,
    currentMonth: null,
    totalOutstanding: 0,
    outstandingCount: 0,
    totalPaidThisYear: 0,
    dues: [],
  },
  homework: {
    total: 0,
    assignments: [],
  },
  examinations: {
    total: 0,
    scheduledPapers: 0,
    list: [],
  },
};

const getStudentDashboardData = async () => {
  const response = await api.get('/student/dashboard');

  const data = response.data?.data || {};

  return {
    student: { ...data.student },
    class: data.class || null,
    academicYear: data.academicYear || '',
    fee: {
      ...STUDENT_DASHBOARD_EMPTY_DATA.fee,
      ...(data.fee || {}),
      currentMonth: data.fee?.currentMonth || null,
      dues: data.fee?.dues || [],
    },
    homework: {
      total: data.homework?.total ?? 0,
      assignments: data.homework?.assignments || [],
    },
    examinations: {
      total: data.examinations?.total ?? 0,
      scheduledPapers: data.examinations?.scheduledPapers ?? 0,
      list: data.examinations?.list || [],
    },
  };
};

const studentDashboardService = {
  getStudentDashboardData,
};

export default studentDashboardService;