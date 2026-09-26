import DateTime from '../DateTime/DateTime';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import NotificationBell from '../NotificationBell/NotificationBell';
import AdminDropdown from '../AdminDropdown/AdminDropdown';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';

const Header = ({ sidebarOpen }) => {
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const schoolName = schoolBranding?.schoolName || '';

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'md:left-64' : 'md:left-16'}
        left-0
      `}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md ring-2 ring-yellow-400/70 flex-shrink-0 overflow-hidden">
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
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden lg:block">
            <DateTime />
          </div>
          <ThemeToggle />
          <NotificationBell />
          <AdminDropdown />
        </div>
      </div>
    </header>
  );
};

export default Header;
