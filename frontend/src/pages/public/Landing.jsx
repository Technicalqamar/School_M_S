import { Link } from 'react-router-dom';
import { AcademicCapIcon, BookOpenIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import AuthLayout from '../../components/Auth/AuthLayout';

// Public entry point: only the Teacher and Student portals are offered here.
// Admin login is intentionally not part of this list (it stays on /admin/login).
const PORTALS = [
  {
    to: '/teacher/login',
    title: 'Teacher Login',
    subtitle: 'Sign in to the teacher portal',
    Icon: AcademicCapIcon,
    iconStyles: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
  },
  {
    to: '/student/login',
    title: 'Student Login',
    subtitle: 'Sign in to the student portal',
    Icon: BookOpenIcon,
    iconStyles: 'bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
  },
];

const Landing = () => (
  <AuthLayout
    role="portal"
    title="Choose Your Portal"
    subtitle="Select how you would like to sign in."
    description="Sign in with the account issued to you by the school administration."
  >
    <div className="space-y-3 sm:space-y-4">
      {PORTALS.map(({ to, title, subtitle, Icon, iconStyles }) => (
        <Link
          key={to}
          to={to}
          className="group flex w-full items-center gap-3 sm:gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <span
            className={`flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${iconStyles}`}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm sm:text-base font-semibold text-gray-900">{title}</span>
            <span className="mt-0.5 block text-xs sm:text-sm text-gray-500 break-words">{subtitle}</span>
          </span>
          <ChevronRightIcon
            className="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-blue-600"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  </AuthLayout>
);

export default Landing;
