import api from '../../api/axios';

// Time Slots API — backed by the `timeslots` collection (Time Slot backend).
// All validation and conflict rules remain authoritative in the backend.
const timeSlotService = {
  getAllTimeSlots: async (params = {}) => {
    const response = await api.get('/time-slots', { params });
    return response.data;
  },

  getTimeSlotById: async (id) => {
    const response = await api.get(`/time-slots/${id}`);
    return response.data;
  },

  createTimeSlot: async (data) => {
    const response = await api.post('/time-slots', data);
    return response.data;
  },

  updateTimeSlot: async (id, data) => {
    const response = await api.put(`/time-slots/${id}`, data);
    return response.data;
  },

  deleteTimeSlot: async (id) => {
    const response = await api.delete(`/time-slots/${id}`);
    return response.data;
  },
};

export default timeSlotService;