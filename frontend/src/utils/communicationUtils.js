// Audiences a Notice or Notification can be addressed to. The school only runs
// the Admin Panel, the Student Portal and the Teacher Panel - there is no Parent
// Portal and no Staff Portal, so `Parents`/`Staff` are not offered. Any existing
// record that still carries one of those values keeps rendering correctly
// through getAudienceLabel below; it simply cannot be selected any more.
export const AUDIENCES = ['All', 'Students', 'Teachers'];
export const SMS_STATUSES = ['Pending', 'Sent', 'Failed'];
export const NOTICE_STATUSES = ['Draft', 'Published', 'Archived'];

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const truncate = (text, n = 70) => {
  const s = String(text || '');
  return s.length > n ? `${s.slice(0, n)}...` : s;
};

export const getAudienceLabel = (t, value) => {
  const map = {
    All: t('everyone'),
    Students: t('audienceStudents'),
    Teachers: t('audienceTeachers'),
    // Legacy values: no longer selectable, but still displayed so notices and
    // notifications created before the audience cleanup keep a readable label.
    Parents: t('audienceParents'),
    Staff: t('audienceStaff'),
  };
  return map[value] || value || t('everyone');
};

// Class scoping only applies to audiences that reach students/parents.
export const classAudienceEnabled = (audience) => ['All', 'Students', 'Parents'].includes(audience);

export const getStatusStyle = (status) => {
  const styles = {
    Pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
    Sent: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    Failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    Draft: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    Published: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    Archived: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  };
  return styles[status] || styles.Pending;
};