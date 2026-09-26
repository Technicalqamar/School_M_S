import { useState } from 'react';
import { useTranslation } from '../../../hooks/useLocalization';
import ClassView from './view/ClassView';
import TeacherView from './view/TeacherView';

const subTabs = ['Class View', 'Teacher View'];

const ViewTimetable = () => {
  const { t } = useTranslation();
  const tabLabels = { 'Class View': t('classLabel'), 'Teacher View': t('teacherLabel') };
  const [activeSubTab, setActiveSubTab] = useState('Class View');

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1">
          {subTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeSubTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </div>

      {activeSubTab === 'Class View' ? <ClassView /> : <TeacherView />}
    </div>
  );
};

export default ViewTimetable;
