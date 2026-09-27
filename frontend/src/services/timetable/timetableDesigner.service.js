import api from '../../api/axios';

// Timetable Management — Designer/View API.
//
// The Designer is read-only: it composes the REAL saved timetable entries into
// a grid grouped by academic year → group (derived from Class Management class
// names) → time slot → class. Classes, time slots and saved entries all come
// from the real backends — nothing is generated, modified or stubbed here.
const timetableDesignerService = {
  getTimetableDesigner: async (params = {}) => {
    const response = await api.get('/timetable/designer', { params });
    return response.data;
  },
};

export default timetableDesignerService;