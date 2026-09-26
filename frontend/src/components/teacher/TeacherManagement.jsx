import { useState } from 'react';
import AllTeachers from './tabs/AllTeachers';
import AddTeacher from './tabs/AddTeacher';
import { useTranslation } from '../../hooks/useLocalization';

const TeacherManagement = () => {
  const { t } = useTranslation();
  const tabs = [t('allTeachers'), t('addTeacher')];
  const tabComponents = { [tabs[0]]: AllTeachers, [tabs[1]]: AddTeacher };
  const [activeTab, setActiveTab] = useState(t('allTeachers'));

  const ActiveComponent = tabComponents[activeTab];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent onSuccess={() => setActiveTab(t('allTeachers'))} />
    </div>
  );
};

export default TeacherManagement;
