import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ReceptionistSidebar from '../components/layout/ReceptionistSidebar/ReceptionistSidebar';
import ReceptionistHeader from '../components/layout/ReceptionistHeader/ReceptionistHeader';

/**
 * Shell for the Receptionist portal.
 *
 * Deliberately its own layout rather than the Admin shell: it carries only the
 * modules a receptionist is permitted to see, has no Admin-only controls, and
 * never renders Admin-sensitive data.
 */
const ReceptionistLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ReceptionistSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <ReceptionistHeader sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      <main
        className={`pt-16 min-h-screen transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-16'
        }`}
      >
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ReceptionistLayout;
