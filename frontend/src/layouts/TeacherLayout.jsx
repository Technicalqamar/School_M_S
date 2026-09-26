import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TeacherSidebar from '../components/layout/TeacherSidebar/TeacherSidebar';
import TeacherHeader from '../components/layout/TeacherHeader/TeacherHeader';

const TeacherLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <TeacherHeader sidebarOpen={sidebarOpen} />
      <div className="flex h-full">
        <TeacherSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto pt-16 px-4 pb-4 md:px-6 md:pb-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TeacherLayout;