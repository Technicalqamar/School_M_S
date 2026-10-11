import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  BanknotesIcon,
  UserGroupIcon,
  ChartBarIcon,
  MegaphoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission } from '../../../constants/receptionistPermissions';

/**
 * Receptionist sidebar.
 *
 * Visibility is driven entirely by the permission set attached to the signed-in
 * account. Items the receptionist is not permitted to open are never rendered.
 * This is a usability layer only: the backend independently enforces every
 * permission on every request, so hiding an item is not the security boundary.
 */
const NAV_ITEMS = [
  { permission: 'dashboard.view', to: '/receptionist/dashboard', end: true, label: 'Dashboard', icon: HomeIcon },
  { permission: 'students.view', to: '/receptionist/students', label: 'Student Records', icon: UsersIcon },
  { permission: 'admissions.view', to: '/receptionist/admissions', label: 'Admissions', icon: ClipboardDocumentCheckIcon },
  { permission: 'attendance.view', to: '/receptionist/attendance', label: 'Student Attendance', icon: CheckCircleIcon },
  { permission: 'fees.view', to: '/receptionist/fees', label: 'Fees & Receipts', icon: BanknotesIcon },
  { permission: 'parents.view', to: '/receptionist/parents', label: 'Parent / Contacts', icon: UserGroupIcon },
  { permission: 'reports.view', to: '/receptionist/reports', label: 'Reports & Exports', icon: ChartBarIcon },
  { permission: 'notices.view', to: '/receptionist/notices', label: 'Notices', icon: MegaphoneIcon },
];

const ReceptionistSidebar = ({ isOpen, toggleSidebar }) => {
  const { user } = useAuth();
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const schoolName = schoolBranding?.schoolName || 'Receptionist';

  const items = NAV_ITEMS.filter((item) => hasPermission(user, item.permission));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-hidden="true"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-16'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={schoolName} className="w-full h-full object-cover" />
              ) : (
                <span>{(schoolName || 'R').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span
              className={`font-semibold text-gray-800 dark:text-white whitespace-nowrap transition-opacity duration-200 ${
                isOpen ? 'opacity-100' : 'opacity-0 md:hidden'
              }`}
            >
              {schoolName}
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-4rem)]">
          {items.length === 0 && (
            <p className={`px-3 py-2 text-xs text-gray-500 dark:text-gray-400 ${isOpen ? '' : 'md:hidden'}`}>
              No modules assigned. Contact an administrator.
            </p>
          )}
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => {
                if (window.innerWidth < 768) toggleSidebar();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg transition-all duration-200 ${
                  isOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'
                } ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-gray-700 hover:text-amber-700 dark:hover:text-amber-400'
                }`
              }
              title={item.label}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className={`text-sm font-medium whitespace-nowrap ${isOpen ? 'block' : 'hidden'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default ReceptionistSidebar;
