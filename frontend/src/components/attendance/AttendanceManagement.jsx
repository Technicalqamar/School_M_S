import { useState } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import StudentAttendance from './tabs/StudentAttendance';
import TeacherAttendance from './tabs/TeacherAttendance';
import IDCardManagement from './tabs/QRCodeManagement';
import AttendanceHistory from './tabs/AttendanceHistory';
import LeaveManagement from './tabs/LeaveManagement';

const AttendanceManagement = () => {
  const { t } = useTranslation();
  const tabs = [t('studentAttendance'), t('teacherAttendance'), t('idCardManagement'), t('attendanceHistory'), t('leave')];
  const tabComponents = {
    [t('studentAttendance')]: StudentAttendance,
    [t('teacherAttendance')]: TeacherAttendance,
    [t('idCardManagement')]: IDCardManagement,
    [t('attendanceHistory')]: AttendanceHistory,
    [t('leave')]: LeaveManagement,
  };
  const [activeTab, setActiveTab] = useState(t('studentAttendance'));

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

      <ActiveComponent />
    </div>
  );
};

export default AttendanceManagement;
