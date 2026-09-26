import { useTranslation } from '../../../../hooks/useLocalization';

const TimetableEmptyState = ({ icon: Icon, title, description }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
      {Icon && (
        <Icon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
      )}
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
      )}
    </div>
  );
};

export default TimetableEmptyState;
