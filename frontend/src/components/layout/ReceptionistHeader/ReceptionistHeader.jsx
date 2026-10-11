import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import DateTime from '../DateTime/DateTime';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';

const ReceptionistHeader = ({ sidebarOpen, toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const schoolName = schoolBranding?.schoolName || '';

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/receptionist/login', { replace: true });
  };

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'md:left-64' : 'md:left-16'}
        left-0
      `}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-amber-400/60 flex-shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
            ) : (
              <span>{(schoolName || 'S').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base md:text-lg font-bold text-gray-800 dark:text-white leading-tight">
              {schoolName || 'School Name'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Receptionist Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden lg:block">
            <DateTime />
          </div>
          <ThemeToggle />

          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <UserCircleIcon className="h-7 w-7 text-gray-500 dark:text-gray-300" />
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[10rem] truncate">
                {user?.fullName || 'Receptionist'}
              </span>
              <ChevronDownIcon className="hidden sm:block h-4 w-4 text-gray-400" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden="true"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                      {user?.fullName || 'Receptionist'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.receptionistId || user?.loginId || ''}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ReceptionistHeader;
