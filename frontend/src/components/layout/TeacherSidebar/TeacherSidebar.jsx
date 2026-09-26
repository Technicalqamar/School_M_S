import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { XMarkIcon, Bars3Icon, ChevronDownIcon } from '@heroicons/react/24/outline';
import useSchoolBranding from '../../../hooks/useSchoolBranding';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';

const TeacherSidebar = ({ isOpen, toggleSidebar }) => {
  const { t } = useTranslation();
  const { schoolBranding } = useSchoolBranding();
  const logoUrl = schoolBranding?.adminPanelLogo ? getImageUrl(schoolBranding.adminPanelLogo) : null;
  const principalName = schoolBranding?.principalName || 'Teacher Portal';
  const [examinationOpen, setExaminationOpen] = useState(false);
  const navItemBase =
    'flex items-center transition-all duration-200 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400';
  const navItemActive = 'bg-blue-500 text-white shadow-md';

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
                to="/teacher/dashboard"
                end
                className={({ isActive }) =>
                  `flex items-center transition-all duration-200 rounded-lg ${
                    isActive ? navItemActive : navItemBase
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
                to="/teacher/dashboard/my-classes"
                className={({ isActive }) =>
                  `flex items-center transition-all duration-200 rounded-lg ${
                    isActive ? navItemActive : navItemBase
                  } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                }
                onClick={() => {
                  if (window.innerWidth < 768) toggleSidebar();
                }}
              >
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {isOpen && (
                  <span className="text-sm font-medium">{t('myClasses')}</span>
                )}
              </NavLink>
            </li>
            <li className="flex justify-center">
              <NavLink
                to="/teacher/dashboard/homework"
                className={({ isActive }) =>
                  `flex items-center transition-all duration-200 rounded-lg ${
                    isActive ? navItemActive : navItemBase
                  } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'}`
                }
                onClick={() => {
                  if (window.innerWidth < 768) toggleSidebar();
                }}
              >
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-6 2a2 2 0 002 2h2a2 2 0 002-2m-6 2v1m0-1h6V5m-6 0h6" />
                </svg>
                {isOpen && (
                  <span className="text-sm font-medium">{t('homeworkAssignments')}</span>
                )}
              </NavLink>
            </li>
            <li className="flex justify-center">
              {isOpen ? (
                <button
                  onClick={() => setExaminationOpen((prev) => !prev)}
                  className={`flex items-center transition-all duration-200 rounded-lg ${navItemBase} ${
                    isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)]' : 'w-10 h-10 justify-center'
                  }`}
                  aria-expanded={examinationOpen}
                >
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m4-1v4m-4-4h4" />
                  </svg>
                  <span className="text-sm font-medium whitespace-nowrap">{t('examinationManagement')}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 ml-auto flex-shrink-0 transition-transform duration-200 ${
                      examinationOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (window.innerWidth >= 768) toggleSidebar();
                    setExaminationOpen(true);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 cursor-pointer"
                  aria-label={t('examinationManagement')}
                  title={t('examinationManagement')}
                >
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m4-1v4m-4-4h4" />
                  </svg>
                </button>
              )}
            </li>
            {examinationOpen && (
              <>
                <li className="flex justify-center">
                  <NavLink
                    to="/teacher/dashboard/marks-entry"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive ? navItemActive : navItemBase
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)] ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m4-1v4m-4-4h4" />
                  </svg>
                  {isOpen && (
                    <span className="text-sm font-medium">{t('marksEntry')}</span>
                  )}
                </NavLink>
              </li>
              <li className="flex justify-center">
                <NavLink
                  to="/teacher/dashboard/my-results"
                  className={({ isActive }) =>
                    `flex items-center transition-all duration-200 rounded-lg ${
                      isActive ? navItemActive : navItemBase
                    } ${isOpen ? 'px-3 py-2.5 gap-3 w-[calc(100%-16px)] ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3' : 'w-10 h-10 justify-center'}`
                  }
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                >
                  <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {isOpen && (
                    <span className="text-sm font-medium">{t('myResults')}</span>
                  )}
                </NavLink>
              </li>
              </>
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default TeacherSidebar;