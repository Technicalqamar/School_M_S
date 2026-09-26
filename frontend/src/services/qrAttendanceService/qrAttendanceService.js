import api from '../../api/axios';

const qrAttendanceService = {
  scanStudentAttendance: async (data = {}) => {
    const response = await api.post('/attendance/qr-scan', data);
    return response.data?.data || response.data;
  },

  scanTeacherAttendance: async (data = {}) => {
    const response = await api.post('/attendance/qr-scan', data);
    return response.data?.data || response.data;
  },

  scanAnyAttendance: async (data = {}) => {
    const response = await api.post('/attendance/qr-scan', data);
    return response.data?.data || response.data;
  },
};

export default qrAttendanceService;
