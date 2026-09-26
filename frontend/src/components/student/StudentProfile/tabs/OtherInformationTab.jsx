import { ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { EmptyState } from '../shared';
import { formatDate } from '../helpers';

const OtherInformationTab = ({ student }) => {
  const hasSystemInfo = student._id || student.createdAt || student.updatedAt;

  if (!hasSystemInfo && !student.alternatePhone && !student.admissionNumber) {
    return (
      <EmptyState
        icon={InformationCircleIcon}
        title="No additional information available"
        message="Other student details will appear here once available."
      />
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <details className="group" open>
        <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
          <span className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wider">
            General Information
          </span>
          <ChevronDownIcon className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Student ID</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.studentId || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Admission Number</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.admissionNumber || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Alternate Phone</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.alternatePhone || '-'}</p>
          </div>
        </div>
      </details>

      {hasSystemInfo && (
        <details className="group border-t border-gray-100 dark:border-gray-700">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
            <span className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wider">
              System Information
            </span>
            <ChevronDownIcon className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Database ID</p>
              <p className="text-sm font-medium font-mono text-gray-900 dark:text-white break-all">{student._id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Profile Created</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(student.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(student.updatedAt)}</p>
            </div>
          </div>
        </details>
      )}
    </div>
  );
};

export default OtherInformationTab;