import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SelectedStudentProvider } from '../components/student/SingleStudent/SelectedStudentContext';
import Sidebar from '../components/layout/Sidebar/Sidebar';
import Header from '../components/layout/Header/Header';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <SelectedStudentProvider>
      <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        <Header sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="flex h-full">
          <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
          <main className="flex-1 overflow-y-auto pt-16 px-4 pb-4 md:px-6 md:pb-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <Outlet />
          </main>
        </div>
      </div>
    </SelectedStudentProvider>
  );
};

export default AdminLayout;
