import api from '../../api/axios';

const studentAttendanceService = {
  getStudentsWithAttendance: async (params = {}) => {
    const response = await api.get('/student-attendance/students', { params });
    return response.data;
  },

  saveAttendance: async (data) => {
    const response = await api.post('/student-attendance', data);
    return response.data;
  },

  getAttendanceByClass: async (params = {}) => {
    const response = await api.get('/student-attendance/by-class', { params });
    return response.data;
  },

  getAttendanceByDate: async (params = {}) => {
    const response = await api.get('/student-attendance/by-date', { params });
    return response.data;
  },

  getAttendanceByStudent: async (studentId, params = {}) => {
    const response = await api.get(`/student-attendance/student/${studentId}`, { params });
    return response.data;
  },

  getAttendanceHistory: async (params = {}) => {
    const response = await api.get('/student-attendance/history', { params });
    return response.data;
  },

  getAttendanceReports: async (params = {}) => {
    const response = await api.get('/student-attendance/reports', { params });
    return response.data;
  },

  deleteAttendance: async (id) => {
    const response = await api.delete(`/student-attendance/${id}`);
    return response.data;
  },

  deleteBulkAttendance: async (params = {}) => {
    const response = await api.delete('/student-attendance', { params });
    return response.data;
  },

  resetCheckIn: async (data) => {
    const response = await api.patch('/student-attendance/check-in', data);
    return response.data;
  },
};

export default studentAttendanceService;
