import { useState } from 'react';
import TimeSlots from '../TimeSlots/TimeSlots';
import CreateTimetable from '../CreateTimetable/CreateTimetable';
import Designer from '../Designer/Designer';

const TABS = [
  { key: 'create-timetable', label: 'Create Timetable', component: CreateTimetable },
  { key: 'designer', label: 'Designer', component: Designer },
  { key: 'time-slots', label: 'Time Slots', component: TimeSlots },
];

const TimetableManagement = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].key);

  const ActiveComponent = TABS.find((tab) => tab.key === activeTab).component;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent />
    </div>
  );
};

export default TimetableManagement;