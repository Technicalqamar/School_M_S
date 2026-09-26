import api from '../../api/axios';

/**
 * Dashboard service — the single integration point for the Main Admin Dashboard.
 * All getters resolve live data from the protected GET /dashboard endpoint,
 * which reads real statistics from the Student, Teacher, Class, FeeStructure and
 * FeeCollection collections for the configured academic year.
 */

export const DASHBOARD_EMPTY_DATA = {
  statistics: {
    totalStudents: null,
    totalTeachers: null,
    totalClasses: null,
    totalFeeCollected: null,
    outstandingDues: null,
    newAdmissions: null,
  },
  studentOverview: {
    active: null,
    inactive: null,
  },
  feeOverview: {
    month: '',
    year: '',
    expected: null,
    collected: null,
    outstanding: null,
  },
  studentsByClass: [],
  monthlyCollection: [],
};

const fetchDashboard = async (academicYear) => {
  const response = await api.get('/dashboard', { params: academicYear ? { academicYear } : {} });

  return response.data.data;
};

const getStatistics = async (academicYear) => {
  const data = await fetchDashboard(academicYear);

  return data.statistics;
};

const getStudentOverview = async (academicYear) => {
  const data = await fetchDashboard(academicYear);

  return data.studentOverview;
};

const getFeeOverview = async (academicYear) => {
  const data = await fetchDashboard(academicYear);

  return data.feeOverview;
};

const getStudentsByClass = async (academicYear) => {
  const data = await fetchDashboard(academicYear);

  return data.studentsByClass;
};

const getMonthlyFeeCollection = async (academicYear) => {
  const data = await fetchDashboard(academicYear);

  return data.monthlyCollection;
};

const getDashboardData = async (academicYear) => fetchDashboard(academicYear);

const dashboardService = {
  getStatistics,
  getStudentOverview,
  getFeeOverview,
  getStudentsByClass,
  getMonthlyFeeCollection,
  getDashboardData,
};

export default dashboardService;