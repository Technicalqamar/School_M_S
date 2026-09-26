import { EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';

const ActionButtons = ({ onView, onEdit, onDelete }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          onClick={onView}
          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          title={t('view')}
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer"
          title={t('edit')}
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
          title={t('delete')}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ActionButtons;
