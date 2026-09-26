import api from '../../api/axios';

const EVENT_CATEGORIES = ['Annual Function', 'Sports Day', 'Independence Day', 'Teachers Day', 'Parents Meeting', 'Science Exhibition', 'Seminar', 'Workshop', 'Competition', 'Examination', 'Orientation', 'Cultural Program', 'Other'];
const HOLIDAY_TYPES = ['Public Holiday', 'National Holiday', 'Religious Holiday', 'School Holiday', 'Emergency Holiday', 'Summer Vacation', 'Winter Vacation', 'Exam Break'];
const AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];
const STATUSES = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getMonthDateRange = (monthName, year) => {
  const idx = MONTHS.indexOf(monthName);
  if (idx === -1) return {};
  const y = year || new Date().getFullYear();
  const from = `${y}-${String(idx + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, idx + 1, 0).getDate();
  const to = `${y}-${String(idx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { fromDate: from, toDate: to };
};

const eventsService = {
  getEvents: async (params = {}) => {
    const query = { ...params };
    if (params.month) {
      const range = getMonthDateRange(params.month, params.academicYear);
      delete query.month;
      if (range.fromDate) {
        query.fromDate = range.fromDate;
        query.toDate = range.toDate;
      }
    }
    const response = await api.get('/events', { params: query });
    return response.data.data;
  },

  getEventById: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data.data;
  },

  getEventAcademicYears: async () => {
    const response = await api.get('/events/academic-years');
    return response.data.data?.years || [];
  },

  createEvent: async (formData) => {
    const response = await api.post('/events', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateEvent: async (id, formData) => {
    const response = await api.put(`/events/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteEvent: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },

  getCalendarEvents: async (params = {}) => {
    const response = await api.get('/events/calendar', { params });
    return response.data.data.events || [];
  },

  getHolidays: async (params = {}) => {
    const response = await api.get('/holidays', { params });
    return response.data.data;
  },

  getHolidayById: async (id) => {
    const response = await api.get(`/holidays/${id}`);
    return response.data.data;
  },

  getHolidayAcademicYears: async () => {
    const response = await api.get('/holidays/academic-years');
    return response.data.data?.years || [];
  },

  createHoliday: async (data) => {
    const response = await api.post('/holidays', data);
    return response.data;
  },

  updateHoliday: async (id, data) => {
    const response = await api.put(`/holidays/${id}`, data);
    return response.data;
  },

  deleteHoliday: async (id) => {
    const response = await api.delete(`/holidays/${id}`);
    return response.data;
  },

  getCalendarHolidays: async (params = {}) => {
    const response = await api.get('/holidays/calendar', { params });
    return response.data.data.holidays || [];
  },

  getGalleryByEvent: async (eventId) => {
    const response = await api.get(`/event-gallery/event/${eventId}`);
    return response.data.data;
  },

  uploadGalleryImage: async (formData) => {
    const response = await api.post('/event-gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  bulkUploadGallery: async (formData) => {
    const response = await api.post('/event-gallery/bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateGalleryImage: async (id, data) => {
    const response = await api.put(`/event-gallery/${id}`, data);
    return response.data;
  },

  deleteGalleryImage: async (id) => {
    const response = await api.delete(`/event-gallery/${id}`);
    return response.data;
  },

  deleteGalleryByEvent: async (eventId) => {
    const response = await api.delete(`/event-gallery/event/${eventId}`);
    return response.data;
  },

  getStats: async (params = {}) => {
    const [eventsRes, holidaysRes, upcomingEventsRes, upcomingHolidaysRes] = await Promise.all([
      api.get('/events', { params: { ...params, limit: '1' } }),
      api.get('/holidays', { params: { ...params, limit: '1' } }),
      api.get('/events', { params: { ...params, status: 'Upcoming', limit: '1' } }),
      api.get('/holidays', { params: { ...params, status: 'Upcoming', limit: '1' } }),
    ]);
    return {
      totalEvents: eventsRes.data.data?.pagination?.totalItems || 0,
      totalHolidays: holidaysRes.data.data?.pagination?.totalItems || 0,
      upcomingEvents: upcomingEventsRes.data.data?.pagination?.totalItems || 0,
      upcomingHolidays: upcomingHolidaysRes.data.data?.pagination?.totalItems || 0,
    };
  },

  EVENT_CATEGORIES,
  HOLIDAY_TYPES,
  AUDIENCES,
  STATUSES,
  MONTHS,
};

export default eventsService;
