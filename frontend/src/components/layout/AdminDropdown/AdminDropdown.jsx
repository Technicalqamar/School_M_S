import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, UserCircleIcon, Cog6ToothIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import authService from '../../../services/auth/auth.service';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';
import ProfileModal from '../ProfileModal/ProfileModal';
import AccountSettingsModal from '../AccountSettingsModal/AccountSettingsModal';

const AdminDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const { t } = useTranslation();
  const dropdownRef = useRef(null);
  const { logout } = useAuth();

  const fetchProfile = async () => {
    try {
      const data = await authService.getProfile();
      setProfile(data.user);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfile();
  }, []);

  const handleProfileUpdated = () => {
    fetchProfile();
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const profileImageUrl = getImageUrl(profile?.profileImage);
  const initials = profile?.fullName
    ? profile.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm ring-1 ring-yellow-400/50 overflow-hidden">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
          {profile?.fullName || 'Admin'}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 overflow-hidden">
          <button
            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={() => { setProfileOpen(true); setIsOpen(false); }}
          >
            <UserCircleIcon className="mr-2.5 h-4 w-4" /> {t('profile')}
          </button>
          <button
            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={() => { setAccountSettingsOpen(true); setIsOpen(false); }}
          >
            <Cog6ToothIcon className="mr-2.5 h-4 w-4" /> {t('accountSettings')}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          <button
            className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            onClick={handleLogout}
          >
            <ArrowLeftOnRectangleIcon className="mr-2.5 h-4 w-4" /> {t('logout')}
          </button>
        </div>
      )}
      <ProfileModal key={profileOpen} isOpen={profileOpen} onClose={() => setProfileOpen(false)} onProfileUpdated={handleProfileUpdated} />
      <AccountSettingsModal isOpen={accountSettingsOpen} onClose={() => setAccountSettingsOpen(false)} />
    </div>
  );
};

export default AdminDropdown;
