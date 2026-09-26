const statusStyles = {
  Active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Inactive: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
};

const dotStyles = {
  Active: 'bg-green-500',
  Inactive: 'bg-yellow-500',
};

const AccountStatusBadge = ({ status }) => {
  const badgeClass = statusStyles[status] || statusStyles.Inactive;
  const dotClass = dotStyles[status] || dotStyles.Inactive;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
};

export default AccountStatusBadge;