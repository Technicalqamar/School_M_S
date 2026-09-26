import api from '../../api/axios';

const timetableService = {
  createTimetable: async (data) => {
    const response = await api.post('/timetables', data);
    return response.data;
  },

  getAllTimetables: async () => {
    const response = await api.get('/timetables');
    return response.data;
  },

  getTimetableByClass: async (classId) => {
    const response = await api.get(`/timetables/class/${classId}`);
    return response.data;
  },

  getTimetableById: async (id) => {
    const response = await api.get(`/timetables/${id}`);
    return response.data;
  },

  updateTimetable: async (id, data) => {
    const response = await api.put(`/timetables/${id}`, data);
    return response.data;
  },

  deleteTimetable: async (id) => {
    const response = await api.delete(`/timetables/${id}`);
    return response.data;
  },

  getClassSubjects: async (classId) => {
    const response = await api.get(`/timetables/class/${classId}/subjects`);
    return response.data;
  },

  getSubjectTeachers: async (subjectId) => {
    const response = await api.get(`/timetables/subject/${subjectId}/teachers`);
    return response.data;
  },
};

export default timetableService;
