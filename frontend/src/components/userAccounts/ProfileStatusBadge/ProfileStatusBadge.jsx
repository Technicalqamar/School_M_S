const statusStyles = {
  Active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Inactive: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  Unknown: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const dotStyles = {
  Active: 'bg-green-500',
  Inactive: 'bg-purple-500',
  Unknown: 'bg-gray-400',
};

const ProfileStatusBadge = ({ status }) => {
  const key = ['Active', 'Inactive'].includes(status) ? status : 'Unknown';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[key]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[key]}`} />
      {key === 'Unknown' ? '—' : status}
    </span>
  );
};

export default ProfileStatusBadge;
