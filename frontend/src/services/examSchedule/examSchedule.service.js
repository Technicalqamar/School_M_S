import api from '../../api/axios';

const examScheduleService = {
  getAllExamSchedules: async (params = {}) => {
    const response = await api.get('/exam-schedules', { params });
    return response.data;
  },

  getExamScheduleById: async (id) => {
    const response = await api.get(`/exam-schedules/${id}`);
    return response.data;
  },

  createExamSchedule: async (data) => {
    const response = await api.post('/exam-schedules', data);
    return response.data;
  },

  updateExamSchedule: async (id, data) => {
    const response = await api.put(`/exam-schedules/${id}`, data);
    return response.data;
  },

  deleteExamSchedule: async (id) => {
    const response = await api.delete(`/exam-schedules/${id}`);
    return response.data;
  },
};

export default examScheduleService;