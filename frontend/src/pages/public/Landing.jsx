import { Link } from 'react-router-dom';
import {
  UsersIcon,
  AcademicCapIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  RectangleStackIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import LandingLayout from '../../components/public/LandingLayout';
import ProductPreview from '../../components/public/ProductPreview';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import { getImageUrl } from '../../utils/imageUrl';
import '../../components/public/landing.css';

// Public entry points. Admin is intentionally absent: no Admin card, button,
// link, or CTA exists anywhere on this page, and the Admin login route is
// unchanged. The Receptionist portal is a real route (`/receptionist/login`)
// backed by a live role, so its card links to it like the Student/Teacher cards.

const HERO_CHIPS = ['Students', 'Teachers', 'Attendance', 'Fees', 'Examinations', 'Reports'];

const OVERVIEW = [
  {
    Icon: UsersIcon,
    title: 'One source of truth',
    description: 'Student, teacher, class, and subject records stay consistent across every module.',
  },
  {
    Icon: BanknotesIcon,
    title: 'Fees & examinations',
    description: 'Fee structures, collection, vouchers, exam setup, marks entry, and results.',
  },
  {
    Icon: MegaphoneIcon,
    title: 'Communication & reporting',
    description: 'Notices, notifications, and reports that keep staff and families informed.',
  },
];

const MODULES = [
  { Icon: UsersIcon, title: 'Student Management', description: 'Student profiles, enrollment details, and class assignments.' },
  { Icon: AcademicCapIcon, title: 'Teacher Management', description: 'Teacher records and staff information kept in one place.' },
  { Icon: BookOpenIcon, title: 'Classes & Subjects', description: 'Classes, sections, and the subjects taught across the school.' },
  { Icon: CalendarDaysIcon, title: 'Timetable', description: 'Build and review class and teacher timetables.' },
  { Icon: ClipboardDocumentCheckIcon, title: 'Attendance', description: 'Record and review daily student and teacher attendance.' },
  { Icon: BanknotesIcon, title: 'Fee Management', description: 'Fee structures, collection, vouchers, outstanding dues, and reports.' },
  { Icon: DocumentTextIcon, title: 'Examinations', description: 'Exam setup, schedules, marks entry, admit cards, and results.' },
  { Icon: MegaphoneIcon, title: 'Communication', description: 'Notices and notifications, with optional SMS messaging.' },
  { Icon: ChartBarIcon, title: 'Reports & Analytics', description: 'Dashboard insights, fee reports, and result history.' },
  { Icon: CurrencyDollarIcon, title: 'Payroll', description: 'Manage staff payroll records inside the admin workspace.' },
  { Icon: UserGroupIcon, title: 'User Accounts & Access', description: 'Create accounts and control access by role.' },
  { Icon: Cog6ToothIcon, title: 'School Settings', description: 'Configure school information, academic settings, and branding.' },
];

const PREVIEW_POINTS = [
  'Dashboard overview with key school statistics',
  'Dedicated modules for students, teachers, and attendance',
  'Fee collection, vouchers, and financial reporting',
  'Examination setup, marks entry, and published results',
];

const BENEFITS = [
  { Icon: ShieldCheckIcon, title: 'Role-based portals', description: 'Separate, protected sign-in for each user role.' },
  { Icon: RectangleStackIcon, title: 'Centralised records', description: 'Student and teacher information in one system.' },
  { Icon: ChartBarIcon, title: 'Fees, exams & reports', description: 'Run fee collection, examinations, and reporting together.' },
  { Icon: DevicePhoneMobileIcon, title: 'Works on any screen', description: 'Responsive layouts for desktop, tablet, and mobile.' },
];

const PORTALS = [
  {
    to: '/student/login',
    title: 'Student Login',
    subtitle: 'Homework, attendance, fees, examinations, and notices.',
    Icon: BookOpenIcon,
    iconStyles: 'bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
  },
  {
    to: '/teacher/login',
    title: 'Teacher Login',
    subtitle: 'Classes, attendance, homework, and marks entry.',
    Icon: AcademicCapIcon,
    iconStyles: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
  },
  {
    to: '/receptionist/login',
    title: 'Receptionist Login',
    subtitle: 'Front-desk access to student records, admissions, and fees.',
    Icon: RectangleStackIcon,
    iconStyles: 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
  },
];

const Landing = () => {
  // Branding comes from the existing SchoolConfigProvider's public-settings
  // fetch, so this page adds no new API call. Missing data falls back to text.
  const { schoolInfo } = useSchoolConfig();
  const schoolName = schoolInfo?.name || 'School Management System';
  const logo = schoolInfo?.logo ? getImageUrl(schoolInfo.logo) : null;
  const principalName = schoolInfo?.principalName || '';

  return (
    <LandingLayout schoolName={schoolName} logo={logo} principalName={principalName}>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative w-full overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden="true">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white" />
          <div className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-white" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-8 lg:py-24">
          <div className="landing-fade-up">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-blue-950 px-3 py-1 text-xs font-medium text-blue-100">
              School Management System
            </span>
            <h1
              id="hero-title"
              className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              Everything your school needs, in one place.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-blue-100 sm:text-lg">
              Manage student and teacher records, attendance, timetables, fees, examinations, and
              communication from a single, unified platform.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#portals"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-900 shadow-lg transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Choose your portal
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900 motion-reduce:transition-none"
              >
                Explore features
              </a>
            </div>

            <ul aria-label="Key modules" className="mt-8 flex flex-wrap gap-2">
              {HERO_CHIPS.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-100"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-fade-up landing-delay-2">
            <ProductPreview variant="dashboard" />
          </div>
        </div>
      </section>

      {/* Overview */}
      <section id="overview" aria-labelledby="overview-title" className="scroll-mt-24 w-full bg-white dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Overview
            </p>
            <h2 id="overview-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A complete platform for everyday school administration
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300 sm:text-lg">
              The system brings student and teacher management, classes and subjects, timetables,
              attendance, fee collection, examinations, communication, and reporting into one
              consistent workspace, for both web and mobile.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {OVERVIEW.map(({ Icon, title, description }) => (
              <div
                key={title}
                className="landing-fade-up rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" aria-labelledby="features-title" className="scroll-mt-24 w-full bg-gray-50 dark:bg-gray-900/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Features
            </p>
            <h2 id="features-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Modules built for real school workflows
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              Every capability below is part of the current system.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {MODULES.map(({ Icon, title, description }) => (
              <div
                key={title}
                className="landing-fade-up flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none dark:border-gray-800 dark:bg-gray-900"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits strip */}
      <section aria-labelledby="benefits-title" className="w-full bg-blue-900 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 id="benefits-title" className="sr-only">
            Platform benefits
          </h2>
          <div className="landing-fade-in grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ Icon, title, description }) => (
              <div key={title} className="flex gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-100">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-blue-100/90">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section id="preview" aria-labelledby="preview-title" className="scroll-mt-24 w-full bg-white dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Product preview
            </p>
            <h2 id="preview-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              A clear view of the workspace
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              Dashboards surface key figures at a glance, with dedicated modules for students,
              teachers, attendance, fees, and examinations.
            </p>
          </div>

          <ul className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
            {PREVIEW_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <CheckCircleIcon
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                <span className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-8 lg:grid-cols-3 lg:items-start">
            <div className="landing-fade-up lg:col-span-2">
              <ProductPreview variant="table" />
            </div>
            <div className="landing-fade-up landing-delay-1">
              <ProductPreview variant="mobile" />
            </div>
          </div>

          <p className="mx-auto mt-10 max-w-3xl rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
            The visuals on this page are illustrative UI mockups of the application, not live
            screenshots, and contain no real records.
          </p>
        </div>
      </section>

      {/* Portals */}
      <section id="portals" aria-labelledby="portals-title" className="scroll-mt-24 w-full bg-gray-50 dark:bg-gray-900/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Sign in
            </p>
            <h2 id="portals-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Choose your portal
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              Select the portal that matches your role.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PORTALS.map(({ to, title, subtitle, Icon, iconStyles }) => (
              <Link
                key={to}
                to={to}
                className="group flex w-full flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 motion-reduce:transition-none ${iconStyles}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {subtitle}
                  </span>
                </span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Continue
                  <ChevronRightIcon
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
};

export default Landing;
