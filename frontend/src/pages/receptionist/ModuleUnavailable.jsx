import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

/**
 * Honest placeholder for a module that is not yet wired into the Receptionist
 * portal. Shown when a receptionist lands on the route directly. It is a static
 * face page only: there is no backend endpoint behind it and no permission key
 * in the catalogue, so it can never leak real data or pretend a module works.
 */
const ModuleUnavailable = ({ title }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 px-6 text-center">
    <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
      <WrenchScrewdriverIcon className="h-7 w-7 text-blue-500" />
    </div>
    <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
      This module is not yet available in the Receptionist portal. Please contact
      the administration when it is needed.
    </p>
  </div>
);

export default ModuleUnavailable;