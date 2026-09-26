const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 gap-4">
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value || '-'}</span>
  </div>
);

const EmptyState = ({ icon: Icon, title, message }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
    <Icon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
    {message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{message}</p>}
  </div>
);

export { InfoRow, EmptyState };