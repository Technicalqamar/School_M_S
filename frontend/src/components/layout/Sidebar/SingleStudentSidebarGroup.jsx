import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronDownIcon,
  UserCircleIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  IdentificationIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import { hasModuleAccess } from '../../../constants/receptionistPermissions';
import { useSelectedStudent } from '../../student/SingleStudent/useSelectedStudent';
import { buildStudentPath } from '../../../utils/singleStudent';

const ITEM_CLASS = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
    isActive
      ? 'bg-blue-500 text-white shadow-md font-medium'
      : 'text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
  }`;

// The `Single Student Management` sidebar group.
//
// It appears only while a student workspace is open, shows the selected
// student's name so the context is unmistakable, and links to the workspace's
// child pages, which all keep the same student context. Every task the staff
// member needs (attendance, fee collection, ID card) is performed inside these
// pages, so there is no separate "related modules" list pointing away from the
// workspace. It is not a second sidebar - it is an extra, context-aware section
// inside the existing Admin sidebar, and it never advertises a page the
// workspace route guard would reject.
const SingleStudentSidebarGroup = ({ base, isOpen, onNavigate }) => {
  const { user } = useAuth();
  const { student, basePath } = useSelectedStudent();
  const [open, setOpen] = useState(true);
  const [examsOpen, setExamsOpen] = useState(true);

  // Mirrors the `RequireModule page="all-students"` guard on the workspace
  // route: never advertise a page the user would be redirected away from.
  if (!student || !hasModuleAccess(user, 'student-management', 'all-students')) {
    return null;
  }

  const portalBase = base || basePath || '/admin';
  const portal = portalBase === '/receptionist' ? 'receptionist' : 'admin';
  const label = student.fullName || student.studentId;
  const overviewPath = buildStudentPath(portal, student.studentId);

  const handleNavigate = () => {
    if (typeof onNavigate === 'function') onNavigate();
  };

  const workspaceItems = [
    { key: 'overview', label: 'Overview', icon: UserCircleIcon, section: '', end: true },
    { key: 'academic', label: 'Academic', icon: AcademicCapIcon, section: 'academic' },
    { key: 'attendance', label: 'Attendance', icon: CalendarDaysIcon, section: 'attendance' },
    { key: 'fees', label: 'Fees', icon: BanknotesIcon, section: 'fees' },
    { key: 'id-card', label: 'ID Card', icon: IdentificationIcon, section: 'id-card' },
  ];

  // The exam pages reuse the existing Examination module's endpoints, so they
  // are only advertised to someone the backend would actually serve: listing
  // exams needs `exam-setup`, results need `results` and an admit card needs
  // `admit-card`. Admins hold every grant. This mirrors the route/API guards,
  // so the group never links to a page that would 403.
  const canListExams = hasModuleAccess(user, 'exam-management', 'exam-setup');
  const examItems = [
    { key: 'exams', label: 'Exam Results', section: 'exams', allowed: canListExams && hasModuleAccess(user, 'exam-management', 'results') },
    { key: 'admit-card', label: 'Admit Card', section: 'admit-card', allowed: canListExams && hasModuleAccess(user, 'exam-management', 'admit-card') },
  ].filter((item) => item.allowed);

  // Collapsed sidebar: a single icon that opens the workspace overview.
  if (!isOpen) {
    return (
      <li className="flex justify-center">
        <NavLink
          to={overviewPath}
          title={`Single Student Management: ${label}`}
          onClick={handleNavigate}
          className={({ isActive }) =>
            `flex items-center transition-all duration-200 rounded-lg ${
              isActive
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
            } w-10 h-10 justify-center`
          }
        >
          <UserCircleIcon className="h-5 w-5 flex-shrink-0" />
        </NavLink>
      </li>
    );
  }

  return (
    <li className="flex justify-center">
      <div className="w-[calc(100%-16px)]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <UserCircleIcon className="h-5 w-5 flex-shrink-0" />
            <div className="min-w-0 text-left">
              <span className="block text-sm font-medium truncate">Single Student Management</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">{label}</span>
            </div>
          </div>
          <ChevronDownIcon
            className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
          />
        </button>

        {open && (
          <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
            {workspaceItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={buildStudentPath(portal, student.studentId, item.section)}
                  end={item.end}
                  onClick={handleNavigate}
                  className={ITEM_CLASS}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}

            {examItems.length > 0 && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setExamsOpen((value) => !value)}
                  aria-expanded={examsOpen}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
                    Examinations
                  </span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${examsOpen ? '' : 'rotate-180'}`}
                  />
                </button>

                {examsOpen && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                    {examItems.map((item) => (
                      <NavLink
                        key={item.key}
                        to={buildStudentPath(portal, student.studentId, item.section)}
                        onClick={handleNavigate}
                        className={ITEM_CLASS}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export default SingleStudentSidebarGroup;
