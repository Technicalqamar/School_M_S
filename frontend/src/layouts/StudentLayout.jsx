import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import StudentSidebar from '../components/layout/StudentSidebar/StudentSidebar';
import StudentHeader from '../components/layout/StudentHeader/StudentHeader';

const StudentLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <StudentHeader sidebarOpen={sidebarOpen} />
      <div className="flex h-full">
        <StudentSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto pt-16 px-4 pb-4 md:px-6 md:pb-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default StudentLayout;