import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { XMarkIcon, UserGroupIcon, AcademicCapIcon, BookOpenIcon, ClipboardDocumentListIcon, CalendarDaysIcon, CheckCircleIcon, SparklesIcon, Cog6ToothIcon, ChevronDownIcon, CurrencyDollarIcon, DocumentCheckIcon, UserCircleIcon, BanknotesIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useAuth } from '../../../contexts/AuthContext';
import { hasAnyReceptionistModuleAccess, getVisibleSidebarPages } from '../../../constants/receptionistPermissions';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const [feeManagementOpen, setFeeManagementOpen] = useState(false);
  const [examinationOpen, setExaminationOpen] = useState(false);
  const [userAccountsOpen, setUserAccountsOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const { t } = useTranslation();
  const { preferences } = useSchoolConfig();
  const smsModuleEnabled = preferences?.smsModuleEnabled ?? false;
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const principalName = schoolBranding?.principalName || 'Admin Panel';

  // Role-aware navigation. Admins see every module; a receptionist only sees
  // the modules in their stored permission set (granted by an Admin via the
  // Receptionist Management module). The backend re-checks every API call, so
  // this is a UX mirror of a server-side rule.
  const { user, role } = useAuth();
  const isReceptionist = role === 'receptionist';
  const canAccess = (moduleKey) => !isReceptionist || hasAnyReceptionistModuleAccess(user, moduleKey);

  // Dropdown modules: only the granted pages are rendered, and the collapsed
  // icon opens the first granted page (an action-only grant has no usable page
  // route, so the module row itself disappears when no page is granted).
  const examPages = getVisibleSidebarPages(user, 'exam-management');
  const feePages = getVisibleSidebarPages(user, 'fee-management');
  const accountPages = getVisibleSidebarPages(user, 'user-accounts');
  const communicationPages = getVisibleSidebarPages(user, 'communication').filter(
    (page) => smsModuleEnabled || page.key !== 'sms',
  );

  const EXAM_ITEMS = [
    { to: '/admin/exams/setup', label: 'Exam Setup', pageKey: 'exam-setup' },
    { to: '/admin/exams/subjects-marks', label: 'Subjects & Marks', pageKey: 'subjects-marks' },
    { to: '/admin/exams/schedule', label: 'Exam Schedule', pageKey: 'exam-schedule' },
    { to: '/admin/exams/admit-card', label: 'Admit Card', pageKey: 'admit-card' },
    { to: '/admin/exams/marks-entry', label: 'Marks Entry', pageKey: 'marks-entry' },
    { to: '/admin/exams/results', label: 'Results', pageKey: 'results' },
    { to: '/admin/exams/result-history', label: 'Result History', pageKey: 'result-history' },
  ].filter((item) => examPages.some((page) => page.key === item.pageKey));

  const FEE_ITEMS = [
    { to: '/admin/fees/fee-structure', label: 'feeStructure', pageKey: 'fee-structure' },
    { to: '/admin/fees/collect-fee', label: 'collectFee', pageKey: 'collect-fee' },
    { to: '/admin/fees/student-fee-details', label: 'studentFeeDetails', pageKey: 'student-fee-details' },
    { to: '/admin/fees/outstanding-dues', label: 'outstandingDues', pageKey: 'outstanding-dues' },
    { to: '/admin/fees/reports', label: 'reports', pageKey: 'reports' },
    { to: '/admin/fees/voucher-generation', label: 'feeVoucherGeneration', pageKey: 'voucher-generation' },
  ].filter((item) => feePages.some((page) => page.key === item.pageKey));

  const ACCOUNT_ITEMS = [
    { to: '/admin/accounts/all', label: 'allAccounts', pageKey: 'all-accounts' },
    { to: '/admin/accounts/create', label: 'createAccount', pageKey: 'create-account' },
    { to: '/admin/accounts/access', label: 'accountAccess', pageKey: 'account-access' },
  ].filter((item) => accountPages.some((page) => page.key === item.pageKey));

  const COMMUNICATION_ITEMS = [
    { to: '/admin/communication/sms', label: 'sms', pageKey: 'sms' },
    { to: '/admin/communication/notices', label: 'notices', pageKey: 'notices' },
    { to: '/admin/communication/notifications', label: 'notifications', pageKey: 'notifications' },
  ]
    .filter((item) => smsModuleEnabled || item.to !== '/admin/communication/sms')
    .filter((item) => communicationPages.some((page) => page.key === item.pageKey));

  return (
    <>
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
                    <img src={logoUrl} alt={principalName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{principalName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
                  {principalName}
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
                  <img src={logoUrl} alt={principalName} className="w-full h-full object-cover" />
                ) : (
                  <span>{principalName.charAt(0).toUpperCase()}</span>
                )}
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {canAccess('dashboard') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {isOpen && (
                    <span className="text-sm font-medium">{t('dashboard')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('student-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/students"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <UserGroupIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('studentManagement')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('teacher-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/teachers"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <AcademicCapIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('teacherManagement')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('class-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/classes"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <BookOpenIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('classManagement')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('subject-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/subjects"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <ClipboardDocumentListIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('subjectManagement')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('timetable-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/timetable"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <CalendarDaysIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('timetable')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('attendance-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/attendance"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('attendanceManagement')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {canAccess('events-and-holidays') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/events"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <SparklesIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('eventsAndHolidays')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {EXAM_ITEMS.length > 0 && (
              <li className="flex justify-center">
                {isOpen ? (
                  <div className="w-[calc(100%-16px)]">
                    <button
                      onClick={() => setExaminationOpen(!examinationOpen)}
                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <DocumentCheckIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{t('examManagement')}</span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${examinationOpen ? '' : 'rotate-180'}`} />
                    </button>
                    {examinationOpen && (
                      <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        {EXAM_ITEMS.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isActive
                                  ? 'bg-blue-500 text-white shadow-md font-medium'
                                  : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                              }`
                              }
                            onClick={() => {
                              if (window.innerWidth < 768) toggleSidebar();
                            }}
                          >
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={EXAM_ITEMS[0].to}
                    className={({ isActive }) =>
                      `flex items-center transition-all duration-200 rounded-lg ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                      } w-10 h-10 justify-center`
                      }
                    onClick={() => {
                      if (window.innerWidth < 768) toggleSidebar();
                    }}
                  >
                    <DocumentCheckIcon className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                )}
              </li>
            )}
            {canAccess('payroll-management') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/payroll"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <BanknotesIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium whitespace-nowrap">{t('salaryPayrollManagement')}</span>
                  )}
                </NavLink>
              </li>
            )}
            {FEE_ITEMS.length > 0 && (
              <li className="flex justify-center">
                {isOpen ? (
                  <div className="w-[calc(100%-16px)]">
                    <button
                      onClick={() => setFeeManagementOpen(!feeManagementOpen)}
                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <CurrencyDollarIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{t('feeManagement')}</span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${feeManagementOpen ? '' : 'rotate-180'}`} />
                    </button>
                    {feeManagementOpen && (
                      <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        {FEE_ITEMS.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isActive
                                  ? 'bg-blue-500 text-white shadow-md font-medium'
                                  : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                              }`
                              }
                            onClick={() => {
                              if (window.innerWidth < 768) toggleSidebar();
                            }}
                          >
                            {t(item.label)}
                          </NavLink>
                        ))}
                      </div>
                      )}
                    </div>
                ) : (
                  <NavLink
                    to={FEE_ITEMS[0].to}
                    className={({ isActive }) =>
                      `flex items-center transition-all duration-200 rounded-lg ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                      } w-10 h-10 justify-center`
                      }
                    onClick={() => {
                      if (window.innerWidth < 768) toggleSidebar();
                    }}
                  >
                    <CurrencyDollarIcon className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                )}
              </li>
            )}
            {ACCOUNT_ITEMS.length > 0 && (
              <li className="flex justify-center">
                {isOpen ? (
                  <div className="w-[calc(100%-16px)]">
                    <button
                      onClick={() => setUserAccountsOpen(!userAccountsOpen)}
                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <UserCircleIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{t('userAccounts')}</span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${userAccountsOpen ? '' : 'rotate-180'}`} />
                    </button>
                    {userAccountsOpen && (
                      <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        {ACCOUNT_ITEMS.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isActive
                                  ? 'bg-blue-500 text-white shadow-md font-medium'
                                  : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                              }`
                              }
                            onClick={() => {
                              if (window.innerWidth < 768) toggleSidebar();
                            }}
                          >
                            {t(item.label)}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={ACCOUNT_ITEMS[0].to}
                    className={({ isActive }) =>
                      `flex items-center transition-all duration-200 rounded-lg ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                      } w-10 h-10 justify-center`
                      }
                    onClick={() => {
                      if (window.innerWidth < 768) toggleSidebar();
                    }}
                  >
                    <UserCircleIcon className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                )}
              </li>
            )}
            {/* Receptionist Management: standalone Admin-only module. Never
                shown to receptionists and never grantable through the
                permission editor (the backend also keeps every /receptionists
                API Admin-only). */}
            {role === 'admin' && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/receptionists"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <ShieldCheckIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">Receptionist Management</span>
                  )}
                </NavLink>
              </li>
            )}
            {COMMUNICATION_ITEMS.length > 0 && (
              <li className="flex justify-center">
                {isOpen ? (
                  <div className="w-[calc(100%-16px)]">
                    <button
                      onClick={() => setCommunicationOpen(!communicationOpen)}
                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{t('communication')}</span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${communicationOpen ? '' : 'rotate-180'}`} />
                    </button>
                    {communicationOpen && (
                      <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        {COMMUNICATION_ITEMS.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isActive
                                  ? 'bg-blue-500 text-white shadow-md font-medium'
                                  : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                              }`
                              }
                            onClick={() => {
                              if (window.innerWidth < 768) toggleSidebar();
                            }}
                          >
                            {t(item.label)}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={COMMUNICATION_ITEMS[0].to}
                    className={({ isActive }) =>
                      `flex items-center transition-all duration-200 rounded-lg ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                      } w-10 h-10 justify-center`
                      }
                    onClick={() => {
                      if (window.innerWidth < 768) toggleSidebar();
                    }}
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5 flex-shrink-0" />
                  </NavLink>
                )}
              </li>
            )}
            {canAccess('school-settings') && (
              <li className="flex justify-center">
                <NavLink
                  to="/admin/settings"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <Cog6ToothIcon className="h-5 w-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="text-sm font-medium">{t('schoolSettings')}</span>
                  )}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;