import api from '../../api/axios';

/**
 * Fee Reminders service.
 *
 * Backed by the shared backend reminder service used by both the class-wise
 * Fee Reminders page and the Single Student "Send Fee Reminder" action:
 *   GET  /api/v1/fees/reminders/recipients           (classNames, academicYear, search)
 *   GET  /api/v1/fees/reminders/students/:id/recipient
 *   POST /api/v1/fees/reminders/send                 (classNames, messageTemplate)
 *   POST /api/v1/fees/reminders/students/:id/send    (messageTemplate)
 *
 * `classNames` may be one or more classes. Eligibility and every recipient's
 * outstanding balance are computed server-side from the real fee ledger, and are
 * re-checked again for each recipient immediately before a reminder is written,
 * so the client never decides a balance and a fully-paid student can never be
 * reminded. The server also validates the requested classes and de-duplicates
 * recipients so the same student is never reminded twice in one send.
 */
const feeReminderService = {
  getRecipients: async (params = {}) => {
    const query = { ...params };
    // The list endpoint lives on the query string, where an array would be
    // serialized as `classNames[]=...`; send one comma-separated value instead.
    if (Array.isArray(query.classNames)) query.classNames = query.classNames.join(',');
    const response = await api.get('/fees/reminders/recipients', { params: query });
    return response.data?.data || { eligible: [], defaultTemplate: '', classNames: [] };
  },

  getStudentContext: async (studentId) => {
    const response = await api.get(`/fees/reminders/students/${studentId}/recipient`);
    return response.data?.data || null;
  },

  sendClassReminders: async (data) => {
    const response = await api.post('/fees/reminders/send', data);
    return response.data?.data || { sent: 0, skipped: 0, failed: 0 };
  },

  sendStudentReminder: async (studentId, data) => {
    const response = await api.post(`/fees/reminders/students/${studentId}/send`, data);
    return response.data?.data || {};
  },
};

export default feeReminderService;
