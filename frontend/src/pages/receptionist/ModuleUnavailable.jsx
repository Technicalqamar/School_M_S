import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

/**
 * Honest placeholder for a catalogue module that is not yet wired into the
 * Receptionist portal. Shown only when the receptionist actually holds the
 * module's View permission, so it never pretends a module works and never
 * fabricates data.
 */
const ModuleUnavailable = ({ title }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 px-6 text-center">
    <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
      <WrenchScrewdriverIcon className="h-7 w-7 text-amber-500" />
    </div>
    <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
      This module is not yet available in the Receptionist portal. Your permission for it has been
      saved and will take effect as soon as the module is integrated.
    </p>
  </div>
);

export default ModuleUnavailable;
