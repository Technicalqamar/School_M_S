import api from '../../api/axios';

const timetableDesignService = {
  getDesign: async () => {
    const response = await api.get('/timetable-design');
    return response.data;
  },

  saveDesign: async (data) => {
    const response = await api.put('/timetable-design', data);
    return response.data;
  },
};

export default timetableDesignService;
