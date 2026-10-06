import api from '../../api/axios';

/**
 * Student Portal notice board service.
 *
 * Backed by the audience-scoped endpoints of the existing Communication →
 * Notices module (same `notices` collection, same documents as the Admin
 * Communication → Notices screen):
 *   GET  /api/v1/student/notices            (page, limit, search, unreadOnly)
 *   GET  /api/v1/student/notices/:id
 *   GET  /api/v1/student/notices/unread-count
 *   PUT  /api/v1/student/notices/:id/read
 *   PUT  /api/v1/student/notices/read-all
 *
 * The server decides everything that matters. It returns only `Published`
 * notices whose audience is `Students` or `All`, narrowed to the student's own
 * academic year and classes, and it resolves read/unread state from the
 * authenticated student's own profile. This service therefore never sends a
 * student id, an audience, a status or a readBy list — only presentation
 * options and the id of the notice being opened. Nothing is fabricated here:
 * every field comes straight from the API response.
 */

// Tiny pub/sub so the always-mounted sidebar badge can refresh the moment the
// Notices page marks something read, without polling or a page reload. Scoped
// to this module, so a student's notice count can never trigger a teacher's
// refetch (each portal has its own service instance and its own listeners).
const changeListeners = new Set();
const subscribe = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};
const emitChange = () => changeListeners.forEach((listener) => listener());

const normalizeNotice = (notice) => {
  if (!notice) return null;

  return {
    ...notice,
    id: notice.id || notice._id,
    title: notice.title || '',
    content: notice.content || notice.message || '',
    message: notice.message || notice.content || '',
    audience: notice.audience || null,
    status: notice.status || null,
    // `publishedOn` is the server-resolved publish timestamp (falls back to
    // createdAt for notices stored before the stamp existed).
    publishedOn: notice.publishedOn || notice.publishedAt || notice.createdAt || null,
    academicYear: notice.academicYear || null,
    classNames: notice.classNames || [],
    postedBy: notice.createdBy?.fullName || null,
    // Read state is resolved server-side per student, so an unread notice is
    // simply "no receipt for me yet". Fall back to `false` rather than guessing.
    read: notice.read === true,
    readAt: notice.readAt || null,
  };
};

const getNotices = async (params = {}) => {
  const query = {};
  if (params.search) query.search = params.search;
  if (params.unreadOnly) query.unreadOnly = 'true';
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await api.get('/student/notices', { params: query });
  const data = response.data?.data || {};

  return {
    notices: (data.notices || []).map(normalizeNotice).filter(Boolean),
    pagination: data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 },
  };
};

const getNoticeById = async (id) => {
  const response = await api.get(`/student/notices/${id}`);
  return normalizeNotice(response.data?.data?.notice);
};

const getUnreadCount = async () => {
  const response = await api.get('/student/notices/unread-count');
  return response.data?.data?.count ?? 0;
};

/**
 * Marks one notice read. `changed: false` is a successful no-op — the notice was
 * already read — so opening the same notice twice never duplicates state.
 */
const markAsRead = async (id) => {
  const response = await api.put(`/student/notices/${id}/read`);
  emitChange();
  return {
    notice: normalizeNotice(response.data?.data?.notice),
    changed: response.data?.data?.changed === true,
  };
};

const markAllRead = async () => {
  const response = await api.put('/student/notices/read-all');
  emitChange();
  return response.data?.data?.updatedCount ?? 0;
};

export {
  getNotices,
  getNoticeById,
  getUnreadCount,
  markAsRead,
  markAllRead,
  subscribe,
  emitChange,
};

export default {
  getNotices,
  getNoticeById,
  getUnreadCount,
  markAsRead,
  markAllRead,
  subscribe,
  emitChange,
};