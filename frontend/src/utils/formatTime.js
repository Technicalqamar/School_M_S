export const formatTime = (date, timeFormat = '12') => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  const hour12 = timeFormat === '12';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12 });
};

export const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return '—';
  return timeStr;
};
