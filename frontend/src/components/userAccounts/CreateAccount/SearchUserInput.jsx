import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';
import userAccountService from '../../../services/userAccount/userAccount.service';

const SearchUserInput = ({ userType, selectedUser, onSelect, error }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchLabel = userType === 'student' ? t('searchStudent') : t('searchTeacher');
  const placeholder =
    !userType ? t('selectUserTypeFirst') : !query.trim() ? (userType === 'student' ? t('selectStudentPlaceholder') : t('selectTeacherPlaceholder')) : searchLabel;

  const fetchResults = useCallback(
    async (search) => {
      if (!userType) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const result = await userAccountService.getAvailableProfiles(userType, search.trim());
        setResults(result.data?.profiles || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [userType],
  );

  useEffect(() => {
    if (!userType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setResults([]);
      setOpen(false);
    }
  }, [userType]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (userType && (query.trim() || open)) {
        fetchResults(query);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [query, userType, open, fetchResults]);

  const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const handleChange = (e) => {
    setQuery(e.target.value);
    if (selectedUser) onSelect(null);
    setOpen(true);
  };

  const handleSelect = (user) => {
    onSelect(user);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setOpen(false);
  };

  const inputValue = selectedUser && !query ? `${selectedUser.fullName} (${selectedUser.profileId})` : query;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {userType === 'student' ? t('selectStudent') : t('selectTeacher')} <span className="text-red-500">*</span>
      </label>
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setTimeout(() => setOpen(false), 150);
          }
        }}
      >
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => {
            setOpen(true);
            if (userType && !results.length && !loading) fetchResults('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          disabled={!userType}
          className={`appearance-none block w-full pl-10 pr-9 py-2.5 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all duration-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
            error ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-300'
          } ${!userType ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : ''}`}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && selectedUser && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            tabIndex={-1}
            aria-label="Clear selection"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}

        {open && userType && (
          <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
            {!loading && results.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t('noUsersFound')}</li>
            )}
            {!loading &&
              results.map((user) => (
                <li key={user._id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 ring-1 ring-yellow-400/50 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {getInitials(user.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.fullName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {t('userId')}: {user.profileId}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default SearchUserInput;
