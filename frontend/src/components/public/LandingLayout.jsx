import { Link } from 'react-router-dom';

// Presentational, landing-only layout.
//
// Deliberately independent from components/Auth/AuthLayout.jsx, which is shared
// by every login and password-recovery screen and must not be modified. Provides
// the public page shell: a responsive header with the school branding, the main
// content area, and a footer. The Admin area is intentionally never referenced.
const NAV_LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#features', label: 'Features' },
  { href: '#preview', label: 'Product' },
  { href: '#portals', label: 'Portals' },
];

const landingLinkClass =
  'text-sm text-gray-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:text-blue-400';

const LandingLayout = ({ schoolName, logo, principalName, children }) => {
  const year = new Date().getFullYear();
  const safeName = (schoolName || '').trim() || 'School Management System';
  const initial = safeName.charAt(0).toUpperCase() || 'S';

  const brand = (sizeClasses) =>
    logo ? (
      <img src={logo} alt={safeName} className={`${sizeClasses} flex-shrink-0 rounded-lg object-contain`} />
    ) : (
      <span
        aria-hidden="true"
        className={`${sizeClasses} flex flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-sm font-bold text-white`}
      >
        {initial}
      </span>
    );

  return (
    <div
      id="top"
      className="flex min-h-screen w-full flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100"
    >
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/70 bg-white/85 backdrop-blur dark:border-gray-800 dark:bg-gray-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {brand('h-9 w-9 sm:h-10 sm:w-10')}
            <span className="min-w-0 truncate text-sm font-semibold sm:text-base">{safeName}</span>
          </a>

          <nav aria-label="Landing page sections" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#portals"
              className="ml-1 inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <main className="w-full flex-1">{children}</main>

      <footer className="w-full border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                {brand('h-9 w-9')}
                <span className="min-w-0 truncate text-sm font-semibold">{safeName}</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                A unified platform for student, teacher, and school administration workflows.
              </p>
              {principalName && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">{principalName}</p>
              )}
            </div>

            <nav aria-label="Explore sections">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Explore</h2>
              <ul className="mt-4 space-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={landingLinkClass}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Sign-in portals">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Portals</h2>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link to="/student/login" className={landingLinkClass}>
                    Student Login
                  </Link>
                </li>
                <li>
                  <Link to="/teacher/login" className={landingLinkClass}>
                    Teacher Login
                  </Link>
                </li>
                <li>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Receptionist — coming soon</span>
                </li>
              </ul>
            </nav>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Platform</h2>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>Student &amp; teacher records</li>
                <li>Attendance, fees &amp; exams</li>
                <li>Notices &amp; notifications</li>
                <li>Reports &amp; analytics</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-gray-200 pt-6 dark:border-gray-800 sm:flex-row">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © {year} {safeName}. All rights reserved.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Built for everyday school administration.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingLayout;
