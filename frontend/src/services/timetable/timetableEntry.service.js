import api from '../../api/axios';

// Timetable Management — Create Timetable API, backed by the `timetableentries`
// collection (Timetable backend). Group derivation, teacher resolution and all
// conflict rules (duplicate, teacher overlap, break protection) remain
// authoritative in the backend.
const timetableEntryService = {
  getAllTimetableEntries: async (params = {}) => {
    const response = await api.get('/timetable', { params });
    return response.data;
  },

  getTimetableEntryById: async (id) => {
    const response = await api.get(`/timetable/${id}`);
    return response.data;
  },

  createTimetableEntry: async (data) => {
    const response = await api.post('/timetable', data);
    return response.data;
  },

  updateTimetableEntry: async (id, data) => {
    const response = await api.put(`/timetable/${id}`, data);
    return response.data;
  },

  deleteTimetableEntry: async (id) => {
    const response = await api.delete(`/timetable/${id}`);
    return response.data;
  },
};

export default timetableEntryService;