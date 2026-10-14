import { useState } from 'react';
import AllTeachers from './tabs/AllTeachers';
import AddTeacher from './tabs/AddTeacher';
import { useTranslation } from '../../hooks/useLocalization';
import { useAuth } from '../../contexts/AuthContext';
import { filterTabsByPermission } from '../../constants/receptionistPermissions';

const TeacherManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const allTabs = [
    { key: 'All Teachers', label: t('allTeachers') },
    { key: 'Add Teacher', label: t('addTeacher') },
  ];
  const tabComponents = {
    'All Teachers': AllTeachers,
    'Add Teacher': AddTeacher,
  };

  const tabs = filterTabsByPermission(user, 'teacher-management', allTabs);
  const [activeTab, setActiveTab] = useState(allTabs[0].key);
  if (tabs.length === 0) return null;
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0].key;

  const ActiveComponent = tabComponents[currentTab];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                currentTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent onSuccess={() => setActiveTab('All Teachers')} />
    </div>
  );
};

export default TeacherManagement;