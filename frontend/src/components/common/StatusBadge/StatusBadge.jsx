const variantClasses = {
  Active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Promoted: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
};

const dotVariant = {
  Active: 'bg-green-500',
  Promoted: 'bg-blue-500',
};

const StatusBadge = ({ status }) => {
  const badgeClass = variantClasses[status] || 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  const dotClass = dotVariant[status] || 'bg-red-500';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
};

export default StatusBadge;
