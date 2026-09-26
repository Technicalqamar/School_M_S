import api from '../../api/axios';

const teacherAttendanceService = {
  getTeachersWithAttendance: async (params = {}) => {
    const response = await api.get('/teacher-attendance/teachers', { params });
    return response.data;
  },

  saveAttendance: async (data) => {
    const response = await api.post('/teacher-attendance', data);
    return response.data;
  },

  qrScanTeacherAttendance: async (data) => {
    const response = await api.post('/teacher-attendance/qr-scan', data);
    return response.data;
  },

  deleteAttendance: async (id) => {
    const response = await api.delete(`/teacher-attendance/${id}`);
    return response.data;
  },

  resetCheckIn: async (data) => {
    const response = await api.patch('/teacher-attendance/check-in', data);
    return response.data;
  },
};

export default teacherAttendanceService;
