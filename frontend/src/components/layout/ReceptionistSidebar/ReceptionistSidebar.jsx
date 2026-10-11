import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  CheckCircleIcon,
  BanknotesIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission } from '../../../constants/receptionistPermissions';

/**
 * Receptionist portal desktop sidebar (from `md` up), styled with the same
 * design language as the Teacher/Student sidebars (same width tokens, header
 * height, logo treatment, blue accent, active/inactive states and dark mode).
 *
 * Visibility is driven entirely by the permission set attached to the signed-in
 * account: items the receptionist is not permitted to open are never rendered.
 * This is a usability layer only - the backend independently enforces every
 * permission on every request.
 *
 * Below `md` the layout is driven by MobileBottomNav, so this sidebar stays
 * parked off-canvas at those widths.
 */
const NAV_ITEMS = [
  { permission: 'dashboard.view', to: '/receptionist/dashboard', end: true, label: 'Dashboard', icon: HomeIcon },
  { permission: 'students.view', to: '/receptionist/students', end: false, label: 'Student Records', icon: UsersIcon },
  { permission: 'attendance.view', to: '/receptionist/attendance', end: false, label: 'Student Attendance', icon: CheckCircleIcon },
  { permission: 'fees.view', to: '/receptionist/fees', end: false, label: 'Fees & Dues', icon: BanknotesIcon },
  { permission: 'notices.view', to: '/receptionist/notices', end: false, label: 'Notices', icon: MegaphoneIcon },
];

const navItemBase =
  'flex items-center transition-all duration-200 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-700 hover:text-blue-600 dark:hover:text-blue-400';
const navItemActive = 'bg-blue-500 text-white shadow-md';

const ReceptionistSidebar = ({ isOpen, toggleSidebar }) => {
  const { user } = useAuth();
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const schoolName = schoolBranding?.schoolName || 'Receptionist';

  const items = NAV_ITEMS.filter((item) => hasPermission(user, item.permission));

  return (
    <aside
      className={`
        fixed top-16 left-0 bottom-0 z-40
        md:relative md:top-0 md:bottom-auto md:min-h-full md:z-0
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg
        transition-all duration-300 ease-in-out
        -translate-x-full w-64 md:translate-x-0 ${isOpen ? 'md:w-64' : 'md:w-16'}
        flex flex-col flex-shrink-0
      `}
    >
      {/* Branding row - same height and treatment as the other portal sidebars. */}
      <div className="h-16 flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between w-full px-4">
          {isOpen ? (
            <>
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex items-center gap-3 min-w-0 cursor-pointer"
                title={schoolName}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm ring-1 ring-yellow-400/70 flex-shrink-0 overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(schoolName || 'R').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
                  {schoolName}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Collapse sidebar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex items-center justify-center w-full cursor-pointer"
              title={schoolName}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm ring-1 ring-yellow-400/70 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
                ) : (
                  <span>{(schoolName || 'R').charAt(0).toUpperCase()}</span>
                )}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Navigation - permission-filtered. */}
      <nav className="flex-1 overflow-y-auto py-4">
        {items.length === 0 ? (
          <p className={`px-3 py-2 text-xs text-gray-500 dark:text-gray-400 ${isOpen ? '' : 'md:hidden'}`}>
            No modules assigned. Contact an administrator.
          </p>
        ) : (
          <ul className="space-y-1 px-2">
            {items.map((item) => (
              <li key={item.to} className="flex justify-center">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `${isActive ? navItemActive : navItemBase} ${isOpen ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}`
                  }
                  title={item.label}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className={`text-sm font-medium ${isOpen ? 'ml-3 truncate' : 'hidden'}`}>
                    {item.label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
};

export default ReceptionistSidebar;