import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, KeyIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Receptionist account menu (profile avatar, change password, logout).
 *
 * Change Password opens the shared role-scoped password-change screen, which is
 * the same first-login mechanism used for Student/Teacher accounts and works for
 * a receptionist regardless of their module permissions - it is an
 * account-security operation, not a business module.
 */
const ReceptionistDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const name = user?.fullName || 'Receptionist';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/receptionist/login', { replace: true });
  };

  const handleChangePassword = () => {
    setIsOpen(false);
    navigate('/receptionist/change-password');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={name}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm ring-1 ring-yellow-400/50 overflow-hidden flex-shrink-0">
          {initials}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
          {name}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.receptionistId || 'Receptionist'}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleChangePassword}
            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <KeyIcon className="mr-2.5 h-4 w-4" /> Change password
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
          >
            <ArrowRightOnRectangleIcon className="mr-2.5 h-4 w-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default ReceptionistDropdown;