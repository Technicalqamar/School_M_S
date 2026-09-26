import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import { ShieldCheckIcon, NoSymbolIcon, ClockIcon, KeyIcon } from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import Modal from '../../common/Modal/Modal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import AccountStatusBadge from '../AccountStatusBadge/AccountStatusBadge';
import ProfileStatusBadge from '../ProfileStatusBadge/ProfileStatusBadge';
import userAccountService from '../../../services/userAccount/userAccount.service';

const AccountAccess = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState(null);
  const [resetAccount, setResetAccount] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const tabs = [
    { key: 'all', label: t('all') },
    { key: 'Active', label: t('activeAccounts') },
    { key: 'Inactive', label: t('inactiveAccounts') },
  ];

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      let params = { page: 1, limit: 100 };
      if (search) params.search = search;
      const result = await userAccountService.getAllAccounts(params);
      const list = result.data?.accounts || [];
      setAccounts(
        list.map((a) => ({
          ...a,
          _id: a.id,
          userName: a.fullName,
          userType: a.role,
        })),
      );
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const id = setTimeout(() => fetchAccounts(), 300);
    return () => clearTimeout(id);
  }, [fetchAccounts]);

  const filtered = accounts.filter((acc) => activeTab === 'all' || acc.accountStatus === activeTab);

  const totalActive = accounts.filter((a) => a.accountStatus === 'Active').length;
  const totalInactive = accounts.filter((a) => a.accountStatus === 'Inactive').length;

  const recentAccounts = accounts.filter((a) => {
    if (!a.createdAt) return false;
    const created = new Date(a.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return created >= thirtyDaysAgo;
  }).length;

  const handleStatusToggle = async () => {
    if (!confirmState) return;
    const { account, isActive } = confirmState;
    setActionLoading(true);
    try {
      await userAccountService.updateAccountStatus(account._id, isActive);
      toast.success(isActive ? t('accountActivated') : t('accountDeactivated'));
      setConfirmState(null);
      setNewPassword('');
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || t('confirmDeactivate'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetAccount || !newPassword) return;
    setActionLoading(true);
    try {
      await userAccountService.updatePassword(resetAccount._id, newPassword);
      toast.success(t('passwordResetSuccess'));
      setResetAccount(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || t('resetPasswordFor'));
    } finally {
      setActionLoading(false);
    }
  };

  const openReset = (account) => {
    setNewPassword('');
    setResetAccount(account);
  };

  const tableColumns = [
    { key: 'userName', label: t('userName') },
    { key: 'userType', label: t('userType') },
    { key: 'accountStatus', label: t('accountStatus') },
    { key: 'profileStatus', label: t('profileStatus') },
    { key: 'lastLogin', label: t('lastLogin') },
    { key: 'createdAt', label: t('createdDate') },
    { key: 'actions', label: t('actions'), className: 'text-right' },
  ];

  const renderTableRow = (account) => (
    <>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{account.userName}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
        {account.userType === 'student' ? t('roleStudent') : t('roleTeacher')}
      </td>
      <td className="px-4 py-3">
        <AccountStatusBadge status={account.accountStatus} />
      </td>
      <td className="px-4 py-3">
        <ProfileStatusBadge status={account.profileStatus} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {account.lastLogin ? new Date(account.lastLogin).toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
            title={t('resetPasswordFor')}
            onClick={() => openReset(account)}
          >
            <KeyIcon className="h-4 w-4" />
          </button>
          <button
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              account.accountStatus === 'Active'
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
            }`}
            title={account.accountStatus === 'Active' ? t('deactivate') : t('activate')}
            onClick={() =>
              setConfirmState({
                account,
                isActive: account.accountStatus !== 'Active',
              })
            }
          >
            {account.accountStatus === 'Active' ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
        </div>
      </td>
    </>
  );

  const confirmMeta = confirmState
    ? {
        title: confirmState.isActive ? t('activate') : t('deactivate'),
        message: confirmState.isActive ? t('confirmActivate') : t('confirmDeactivate'),
        variant: 'primary',
        onConfirm: handleStatusToggle,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('accountAccess')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('accountAccessSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={ShieldCheckIcon} label={t('activeAccounts')} value={totalActive} color="green" />
        <StatCard icon={NoSymbolIcon} label={t('inactiveAccounts')} value={totalInactive} color="yellow" />
        <StatCard icon={ClockIcon} label={t('recentlyCreated')} value={recentAccounts} color="blue" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1">
          <SearchInput placeholder={t('searchAccounts')} value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t('loadingAccounts')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <Table columns={tableColumns} data={filtered} renderRow={renderTableRow} />
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        title={confirmMeta?.title || ''}
        message={confirmMeta?.message || ''}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        variant={confirmMeta?.variant || 'primary'}
        onConfirm={confirmMeta?.onConfirm}
        loading={actionLoading}
      />

      <Modal isOpen={!!resetAccount} onClose={() => setResetAccount(null)} title={t('resetPasswordFor')} maxWidth="max-w-md">
        {resetAccount && (
          <form onSubmit={handleResetPassword} className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {resetAccount.userName}{' '}
              <span className="text-gray-400">({resetAccount.loginId})</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('enterPassword')} <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('enterPassword')}
                required
                autoFocus
                className="appearance-none block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white dark:bg-gray-800 dark:text-white transition-all duration-200"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetAccount(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newPassword}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {actionLoading ? t('loading') : t('confirm')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AccountAccess;