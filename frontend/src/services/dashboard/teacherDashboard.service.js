import api from '../../api/axios';

/**
 * Teacher Dashboard service — the single integration point for the Teacher Dashboard.
 * All getters resolve live data from the protected GET /teacher/dashboard endpoint,
 * which reads the logged-in teacher's own assigned classes, students and timetable
 * schedule for the configured academic year. Homework has no backend module yet, so
 * the endpoint returns an empty set — never fabricated data.
 */

export const TEACHER_DASHBOARD_EMPTY_DATA = {
  statistics: {
    myClasses: null,
    myStudents: null,
    todayClasses: null,
    pendingHomework: null,
  },
  myClasses: [],
  todayClasses: [],
  upcomingHomework: [],
};

const getTeacherDashboardData = async () => {
  const response = await api.get('/teacher/dashboard');

  const data = response.data?.data || {};

  return {
    statistics: { ...TEACHER_DASHBOARD_EMPTY_DATA.statistics, ...(data.statistics || {}) },
    myClasses: data.myClasses || [],
    todayClasses: data.todayClasses || [],
    upcomingHomework: data.upcomingHomework || [],
  };
};

const teacherDashboardService = {
  getTeacherDashboardData,
};

export default teacherDashboardService;