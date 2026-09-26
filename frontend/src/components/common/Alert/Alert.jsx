import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const Alert = ({ message, type = 'success', className = '' }) => {
  if (!message) return null;

  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
  };

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  const Icon = icons[type];

  return (
    <div className={`flex items-start gap-3 border px-4 py-3 rounded-lg mb-5 ${styles[type]} ${className}`} role="alert">
      {Icon && <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />}
      <span className="text-sm">{message}</span>
    </div>
  );
};

export default Alert;
