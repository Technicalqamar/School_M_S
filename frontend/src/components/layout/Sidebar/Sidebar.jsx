import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { XMarkIcon, Bars3Icon, UserGroupIcon, AcademicCapIcon, BookOpenIcon, ClipboardDocumentListIcon, CalendarDaysIcon, CheckCircleIcon, SparklesIcon, Cog6ToothIcon, ChevronDownIcon, CurrencyDollarIcon, DocumentCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const [feeManagementOpen, setFeeManagementOpen] = useState(false);
  const [examinationOpen, setExaminationOpen] = useState(false);
  const [userAccountsOpen, setUserAccountsOpen] = useState(false);
  const { t } = useTranslation();
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const principalName = schoolBranding?.principalName || 'Admin Panel';
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
            <li className="flex justify-center">
              {isOpen ? (
                <div className="w-[calc(100%-16px)]">
                  <button
                    onClick={() => setExaminationOpen(!examinationOpen)}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <DocumentCheckIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-medium whitespace-nowrap">{t('examinationManagement')}</span>
                    </div>
                    <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${examinationOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {examinationOpen && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                      {[
                        { to: '/admin/exams/setup', label: 'Exam Setup' },
                        { to: '/admin/exams/subjects-marks', label: 'Subjects & Marks' },
                        { to: '/admin/exams/schedule', label: 'Exam Schedule' },
                        { to: '/admin/exams/admit-card', label: 'Admit Card' },
                        { to: '/admin/exams/marks-entry', label: 'Marks Entry' },
                        { to: '/admin/exams/results', label: 'Results' },
                        { to: '/admin/exams/result-history', label: 'Result History' },
                      ].map((item) => (
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
                  to="/admin/exams/setup"
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
                      <NavLink
                        to="/admin/fees/fee-structure"
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
                        {t('feeStructure')}
                      </NavLink>
                      <NavLink
                        to="/admin/fees/collect-fee"
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
                        {t('collectFee')}
                      </NavLink>
                      <NavLink
                        to="/admin/fees/student-fee-details"
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
                        {t('studentFeeDetails')}
                      </NavLink>
                      <NavLink
                        to="/admin/fees/outstanding-dues"
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
                        {t('outstandingDues')}
                      </NavLink>
                      <NavLink
                        to="/admin/fees/reports"
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
                        {t('reports')}
                      </NavLink>
                      <NavLink
                        to="/admin/fees/voucher-generation"
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
                        {t('feeVoucherGeneration')}
                      </NavLink>
                    </div>
                    )}
                  </div>
              ) : (
                <NavLink
                  to="/admin/fees"
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
                    <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${userAccountsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {userAccountsOpen && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                      {[
                        { to: '/admin/accounts/all', label: 'allAccounts' },
                        { to: '/admin/accounts/create', label: 'createAccount' },
                        { to: '/admin/accounts/access', label: 'accountAccess' },
                      ].map((item) => (
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
                  to="/admin/accounts/all"
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
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
