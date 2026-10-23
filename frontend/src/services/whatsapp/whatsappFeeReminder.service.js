import api from '../../api/axios';

/**
 * Admin-only WhatsApp fee reminders.
 *
 *   GET  /api/v1/whatsapp/fee-reminders/recipients
 *   GET  /api/v1/whatsapp/fee-reminders/students/:studentId/preview
 *   POST /api/v1/whatsapp/fee-reminders/send
 *
 * The browser sends only selected student IDs, the academic year and the
 * reminder template. Amounts and destination numbers are resolved and rendered
 * by the server immediately before each send.
 */
const whatsappFeeReminderService = {
  getRecipients: async (params = {}) => {
    const query = { ...params };
    if (Array.isArray(query.classNames)) query.classNames = query.classNames.join(',');
    const response = await api.get('/whatsapp/fee-reminders/recipients', { params: query });
    return (
      response.data?.data || {
        recipients: [],
        eligibleCount: 0,
        defaultTemplate: '',
        academicYear: null,
        maxRecipients: 0,
      }
    );
  },

  getStudentPreview: async (studentId, params = {}) => {
    const response = await api.get(
      `/whatsapp/fee-reminders/students/${encodeURIComponent(studentId)}/preview`,
      { params },
    );
    return response.data?.data || null;
  },

  sendReminders: async (data) => {
    const response = await api.post('/whatsapp/fee-reminders/send', data);
    return response.data?.data || { sent: 0, skipped: 0, failed: 0, results: [] };
  },
};

export default whatsappFeeReminderService;
