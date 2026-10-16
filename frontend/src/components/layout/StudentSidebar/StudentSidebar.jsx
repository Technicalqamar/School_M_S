import { NavLink } from 'react-router-dom';
import { XMarkIcon, HomeIcon, ClipboardDocumentListIcon, BanknotesIcon, AcademicCapIcon, CheckCircleIcon, BellIcon, BellAlertIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';
import { usePortal } from '../../../contexts/PortalContext';

/**
 * Student Portal desktop sidebar.
 *
 * Primary navigation from `md` up only: module order, labels, active styling,
 * collapse/expand and the Notices unread badge are all unchanged.
 *
 * Below `md` the portal is driven by `MobileBottomNav`, so this panel stays
 * parked off-canvas and its mobile drawer (floating open button + overlay) is
 * removed — every module it exposed is reachable from the bottom bar or its More
 * sheet.
 *
 * `unreadNotices` is passed in from `StudentLayout`, giving the badge a single
 * source of truth shared with the mobile More sheet. It is the unread *notice*
 * count only; the Notification Bell keeps its own separate count and the two
 * badges are never combined.
 */
const StudentSidebar = ({ isOpen, toggleSidebar, unreadNotices = 0 }) => {
  const { t } = useTranslation();
  const { schoolBranding } = useSchoolBranding();
  const portal = usePortal();
  const isPortalAccess = Boolean(portal?.isPortalAccess);
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const portalName = schoolBranding?.schoolName || 'Student Portal';
  const navItemBase =
    'flex items-center transition-all duration-200 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-700 hover:text-blue-600 dark:hover:text-blue-400';
  const navItemActive = 'bg-blue-500 text-white shadow-md';

  const base = isPortalAccess ? '/portal/access' : '/student/dashboard';

  const navItems = [
    { to: base, end: true, label: t('dashboard'), icon: HomeIcon },
    { to: `${base}/homework`, end: false, label: t('homeworkAssignments'), icon: ClipboardDocumentListIcon },
    { to: `${base}/fees`, end: false, label: t('fees'), icon: BanknotesIcon },
    { to: `${base}/fee-reminders`, end: false, label: t('feeReminders'), icon: BellAlertIcon },
    { to: `${base}/examination`, end: false, label: t('examination'), icon: AcademicCapIcon },
    { to: `${base}/attendance`, end: false, label: t('attendance'), icon: CheckCircleIcon },
    { to: `${base}/notifications`, end: false, label: t('notifications'), icon: BellIcon },
    { to: `${base}/notices`, end: false, label: t('notices'), icon: MegaphoneIcon, badge: unreadNotices },
  ];

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
          {navItems.map(({ to, end, label, icon: Icon, badge }) => (
            <li className="flex justify-center" key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center transition-all duration-200 rounded-lg ${
                    isActive ? navItemActive : navItemBase
                  } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                }
              >
                <span className="relative flex-shrink-0">
                  <Icon className="h-5 w-5" />
                  {/* Unread notices only. Hidden entirely at 0 so an up-to-date
                      student sees no badge at all. */}
                  {badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"
                      title={`${badge} ${t('unread')}`}
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                {isOpen && <span className="text-sm font-medium">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default StudentSidebar;
