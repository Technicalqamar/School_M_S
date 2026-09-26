import { ClipboardDocumentListIcon, BanknotesIcon, AcademicCapIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../hooks/useLocalization';

const MODULE_ICONS = {
  homeworkAssignments: ClipboardDocumentListIcon,
  fees: BanknotesIcon,
  examination: AcademicCapIcon,
};

const StudentModulePlaceholder = ({ module }) => {
  const { t } = useTranslation();
  const Icon = MODULE_ICONS[module] || WrenchScrewdriverIcon;
  const moduleLabel = t(module);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white shadow-lg ring-2 ring-yellow-400/50 mb-5">
        <Icon className="h-8 w-8" />
      </div>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">{moduleLabel}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        {t('moduleNotAvailable')}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('moduleComingSoon')}</p>
    </div>
  );
};

export default StudentModulePlaceholder;