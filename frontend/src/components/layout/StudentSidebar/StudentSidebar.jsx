import { NavLink } from 'react-router-dom';
import { XMarkIcon, Bars3Icon, HomeIcon, ClipboardDocumentListIcon, BanknotesIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';
import { usePortal } from '../../../contexts/PortalContext';

const StudentSidebar = ({ isOpen, toggleSidebar }) => {
  const { t } = useTranslation();
  const { schoolBranding } = useSchoolBranding();
  const portal = usePortal();
  const isPortalAccess = Boolean(portal?.isPortalAccess);
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const portalName = schoolBranding?.schoolName || 'Student Portal';
  const navItemBase =
    'flex items-center transition-all duration-200 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400';
  const navItemActive = 'bg-blue-500 text-white shadow-md';

  const base = isPortalAccess ? '/portal/access' : '/student/dashboard';

  const navItems = [
    { to: base, end: true, label: t('dashboard'), icon: HomeIcon },
    { to: `${base}/homework`, end: false, label: t('homeworkAssignments'), icon: ClipboardDocumentListIcon },
    { to: `${base}/fees`, end: false, label: t('fees'), icon: BanknotesIcon },
    { to: `${base}/examination`, end: false, label: t('examination'), icon: AcademicCapIcon },
  ];

  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-20 left-3 z-30 md:hidden p-2.5 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          aria-label="Open sidebar"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 top-16 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`
          fixed top-16 left-0 bottom-0 z-40
          md:relative md:top-0 md:bottom-auto md:min-h-full md:z-0
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-16'}
          flex flex-col flex-shrink-0
        `}
      >
        <div className="h-16 flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {isOpen ? (
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm ring-1 ring-yellow-400/70 flex-shrink-0 overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt={portalName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{portalName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
                  {portalName}
                </span>
              </div>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Close sidebar"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <button
                onClick={toggleSidebar}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/70 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                aria-label="Open sidebar"
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={portalName} className="w-full h-full object-cover" />
                ) : (
                  <span>{portalName.charAt(0).toUpperCase()}</span>
                )}
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {navItems.map(({ to, end, label, icon: Icon }) => (
              <li className="flex justify-center" key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive ? navItemActive : navItemBase
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && <span className="text-sm font-medium">{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default StudentSidebar;