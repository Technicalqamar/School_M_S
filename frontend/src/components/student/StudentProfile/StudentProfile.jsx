import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  UserIcon,
  UserCircleIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  IdentificationIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import Spinner from '../../common/Spinner/Spinner';
import ProfileHeader from './ProfileHeader';
import { EmptyState } from './shared';
import { useSelectedStudent } from '../SingleStudent/useSelectedStudent';
import { useAuth } from '../../../contexts/AuthContext';
import { hasModuleAccess } from '../../../constants/receptionistPermissions';
import { buildStudentPath } from '../../../utils/singleStudent';

// The Single Student Management workspace. It is the layout for
// `students/:studentId/*`: it resolves the selected student once (through the
// shared context), keeps their identity visible, and renders each student
// surface as a routed child page so refresh, direct navigation and Back all
// work. Every child route receives the same student through the Outlet
// context, so context is never lost while moving between child pages.
const TABS = [
  { key: 'overview', label: 'Overview', icon: UserCircleIcon, section: '', end: true },
  { key: 'academic', label: 'Academic', icon: AcademicCapIcon, section: 'academic' },
  { key: 'attendance', label: 'Attendance', icon: CalendarDaysIcon, section: 'attendance' },
  { key: 'exams', label: 'Exam Results', icon: DocumentTextIcon, section: 'exams', module: ['exam-management', 'results'] },
  { key: 'admit-card', label: 'Admit Card', icon: ClipboardDocumentCheckIcon, section: 'admit-card', module: ['exam-management', 'admit-card'] },
  { key: 'fees', label: 'Fees', icon: BanknotesIcon, section: 'fees' },
  { key: 'id-card', label: 'ID Card', icon: IdentificationIcon, section: 'id-card' },
];

const StudentProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { student, studentId, status, error, refresh, basePath } = useSelectedStudent();
  const { user } = useAuth();

  // The exam tabs point at the existing Examination endpoints, so they are only
  // shown to a user the backend would actually serve (admins hold every grant).
  // Listing exams needs `exam-setup`, results need `results`, an admit card needs
  // `admit-card`; the tab bar therefore never links to a page that would 403.
  const canListExams = hasModuleAccess(user, 'exam-management', 'exam-setup');
  const visibleTabs = TABS.filter(
    (tab) => !tab.module || (canListExams && hasModuleAccess(user, tab.module[0], tab.module[1])),
  );

  // Keep the user inside whichever portal namespace they are already in.
  const portalBase =
    basePath || (location.pathname.startsWith('/receptionist') ? '/receptionist' : '/admin');
  const portal = portalBase === '/receptionist' ? 'receptionist' : 'admin';
  const goBack = () => navigate(`${portalBase}/students`);

  if (!student && status !== 'error' && status !== 'notfound') {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-blue-600" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="space-y-6">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Student Management
        </button>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <ArrowPathIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Could not load this student
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {error || 'Something went wrong while loading the student profile.'}
          </p>
          <button
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Student Management
        </button>
        <EmptyState
          icon={UserIcon}
          title="Student Not Found"
          message="The requested student could not be found. Select a student from the search to open a workspace."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer self-start"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Student Management
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Single Student Management
        </h1>
      </div>

      {/* The identity banner keeps the selected student unmistakable across
          every child page, so staff can always verify they are on the right
          record. */}
      <ProfileHeader student={student} />

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const to = buildStudentPath(portal, studentId, tab.section);
            return (
              <NavLink
                key={tab.key}
                to={to}
                end={tab.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div>
        <Outlet
          context={{
            student,
            studentId,
            portal,
            basePath: basePath || '/admin',
            refresh,
          }}
        />
      </div>
    </div>
  );
};

export default StudentProfile;
