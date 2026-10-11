import { ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '../../constants/receptionistPermissions';

/**
 * Blocks a receptionist route when the signed-in account lacks `permission`.
 *
 * This mirrors the server-side gate so a user is shown a clear access-denied
 * state instead of an empty or broken screen. It is NOT the security boundary:
 * the backend independently rejects the underlying request with 403.
 */
const RequirePermission = ({ permission, children }) => {
  const { user } = useAuth();

  if (!hasPermission(user, permission)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <ShieldExclamationIcon className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Access denied</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md">
          You do not have permission to open this module. Contact an administrator to request access.
        </p>
      </div>
    );
  }

  return children;
};

export default RequirePermission;
