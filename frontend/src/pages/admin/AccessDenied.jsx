import { Link } from 'react-router-dom';
import { ShieldExclamationIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { findFirstAccessibleModulePath } from '../../constants/receptionistPermissions';

// Honest "you cannot access this" page inside the shared Admin layout. Used when
// a receptionist navigates to an Admin route or module that their stored
// permission set does not grant (the backend denies the underlying APIs too).
const AccessDenied = () => {
  const { user, role, DASHBOARD_ROUTES } = useAuth();

  const backTo = role === 'receptionist'
    ? findFirstAccessibleModulePath(user) || DASHBOARD_ROUTES.receptionist || '/admin'
    : DASHBOARD_ROUTES.admin;

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
          <ShieldExclamationIcon className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your account does not have permission to open this section. If you
          believe this is a mistake, ask an Administrator to update your module
          access.
        </p>
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Go to my home page
        </Link>
      </div>
    </div>
  );
};

export default AccessDenied;