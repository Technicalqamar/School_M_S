import api from '../../api/axios';

// Audiences offered in the Admin Notices audience dropdown (both the create/edit
// form and the list filter). `Parents`/`Staff` were removed because the school
// has no Parent Portal and no Staff Portal; the backend rejects them too.
// Existing records that still carry one of those values are left untouched and
// keep rendering through getAudienceLabel.
const AUDIENCES = ['All', 'Students', 'Teachers'];
const STATUSES = ['Draft', 'Published', 'Archived'];

const normalizeNotice = (notice) => {
  if (!notice) return null;
  return {
    ...notice,
    id: notice.id || notice._id,
    content: notice.content || notice.message,
  };
};

const noticeService = {
  getNotices: async (filters = {}) => {
    const params = {};
    if (filters.audience && filters.audience !== 'All') params.audience = filters.audience;
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    if (filters.search) params.search = filters.search;
    if (filters.academicYear) params.academicYear = filters.academicYear;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    const response = await api.get('/communication/notices', { params });
    const data = response.data?.data || {};
    return {
      notices: (data.notices || []).map(normalizeNotice),
      pagination: data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 },
    };
  },

  getNoticeById: async (id) => {
    const response = await api.get(`/communication/notices/${id}`);
    return normalizeNotice(response.data?.data?.notice) || null;
  },

  createNotice: async (data) => {
    const response = await api.post('/communication/notices', data);
    return normalizeNotice(response.data?.data?.notice) || null;
  },

  updateNotice: async (id, data) => {
    const response = await api.put(`/communication/notices/${id}`, data);
    return normalizeNotice(response.data?.data?.notice) || null;
  },

  deleteNotice: async (id) => {
    const response = await api.delete(`/communication/notices/${id}`);
    return response.data;
  },

  AUDIENCES,
  STATUSES,
};

export default noticeService;