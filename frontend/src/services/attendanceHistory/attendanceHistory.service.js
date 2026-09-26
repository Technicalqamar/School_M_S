import api from '../../api/axios';

const attendanceHistoryService = {
  getRecords: async (filters = {}) => {
    const params = {};
    if (filters.academicYear) params.academicYear = filters.academicYear;
    if (filters.className) params.className = filters.className;
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.search) params.search = filters.search;

    // `type` selects the real backend collection: 'Student' | 'Teacher' | undefined (All).
    const type = filters.type;
    const fetchByType = async (t) => {
      const response = await api.get('/student-attendance/history', { params: { ...params, type: t } });
      return response.data.data?.records || [];
    };

    if (!type || type === 'All') {
      const [studentRecords, teacherRecords] = await Promise.all([
        fetchByType('Student'),
        fetchByType('Teacher'),
      ]);
      return [...studentRecords, ...teacherRecords].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    }
    return fetchByType(type);
  },

  getStats(records) {
    const total = records.length;
    const present = records.filter((r) => r.status === 'Present').length;
    const absent = records.filter((r) => r.status === 'Absent').length;
    const leave = records.filter((r) => r.status === 'Leave').length;
    const late = records.filter((r) => r.status === 'Late').length;
    return { total, present, absent, leave, late };
  },

  getMonthlyStats(records) {
    const monthly = {};
    records.forEach((r) => {
      const month = r.date.slice(0, 7);
      if (!monthly[month]) monthly[month] = { present: 0, absent: 0, leave: 0, late: 0, total: 0 };
      monthly[month][r.status.toLowerCase()]++;
      monthly[month].total++;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  },

  getDailyStats(records, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const recent = records.filter((r) => r.date >= cutoff.toISOString().split('T')[0]);
    const daily = {};
    recent.forEach((r) => {
      if (!daily[r.date]) daily[r.date] = { present: 0, absent: 0, total: 0 };
      daily[r.date].total++;
      if (r.status === 'Present') daily[r.date].present++;
      else daily[r.date].absent++;
    });
    return Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
  },
};

export default attendanceHistoryService;
