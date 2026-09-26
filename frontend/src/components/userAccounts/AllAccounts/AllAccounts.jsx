import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../hooks/useLocalization';
import { UsersIcon, ShieldCheckIcon, NoSymbolIcon, PlusIcon } from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SearchInput from '../../common/SearchInput/SearchInput';
import SelectInput from '../../common/SelectInput/SelectInput';
import Table from '../../common/Table/Table';
import AccountStatusBadge from '../AccountStatusBadge/AccountStatusBadge';
import ProfileStatusBadge from '../ProfileStatusBadge/ProfileStatusBadge';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Modal from '../../common/Modal/Modal';
import userAccountService from '../../../services/userAccount/userAccount.service';

const ITEMS_PER_PAGE = 10;

const AllAccounts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(() => `all::${t('all')}`);
  const [statusFilter, setStatusFilter] = useState(() => `all::${t('all')}`);
  const [profileStatusFilter, setProfileStatusFilter] = useState(() => `all::${t('all')}`);
  const [currentPage, setCurrentPage] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState(null);
  const [viewAccount, setViewAccount] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const roleOptions = [`all::${t('all')}`, `student::${t('roleStudent')}`, `teacher::${t('roleTeacher')}`];
  const statusOptions = [`all::${t('all')}`, `Active::${t('statusActive')}`, `Inactive::${t('statusInactive')}`];
  const profileStatusOptions = [`all::${t('all')}`, `Active::${t('statusActive')}`, `Inactive::${t('statusInactive')}`];

  const valueOf = (encoded) => encoded.split('::')[0];

  const fetchAccounts = useCallback(async () => {
    try {
      const params = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (search) params.search = search;
      const roleVal = valueOf(roleFilter);
      const statusVal = valueOf(statusFilter);
      const profileVal = valueOf(profileStatusFilter);
      if (roleVal !== 'all') params.role = roleVal;
      if (statusVal !== 'all') params.accountStatus = statusVal;
      if (profileVal !== 'all') params.profileStatus = profileVal;

      const result = await userAccountService.getAllAccounts(params);
      setAccounts(result.data?.accounts || []);
      setTotalAccounts(result.data?.pagination?.totalAccounts || 0);
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToLoadAccounts');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, roleFilter, statusFilter, profileStatusFilter, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts();
  }, [fetchAccounts]);

  const totalPages = Math.ceil(totalAccounts / ITEMS_PER_PAGE);

  const totalActive = accounts.filter((a) => a.accountStatus === 'Active').length;
  const totalInactive = accounts.filter((a) => a.accountStatus === 'Inactive').length;

  const getInitials = (name) => name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'UA';

  const handleReset = () => {
    setSearch('');
    setRoleFilter(`all::${t('all')}`);
    setStatusFilter(`all::${t('all')}`);
    setProfileStatusFilter(`all::${t('all')}`);
    setCurrentPage(1);
  };

  const handleStatusToggle = async () => {
    if (!confirmState) return;
    const { account, isActive } = confirmState;
    setActionLoading(true);
    try {
      await userAccountService.updateAccountStatus(account.id, isActive);
      toast.success(isActive ? t('accountActivated') : t('accountDeactivated'));
      setConfirmState(null);
      fetchAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || t('failedToLoadAccounts'));
    } finally {
      setActionLoading(false);
    }
  };

  const tableColumns = [
    { key: 'userName', label: t('userName') },
    { key: 'profileId', label: t('profileId') },
    { key: 'role', label: t('userType') },
    { key: 'accountStatus', label: t('accountStatus') },
    { key: 'profileStatus', label: t('profileStatus') },
    { key: 'lastLogin', label: t('lastLogin') },
    { key: 'lastLogout', label: t('lastLogout') },
    { key: 'createdAt', label: t('createdDate') },
    { key: 'actions', label: t('actions'), className: 'text-right' },
  ];

  const renderTableRow = (account) => (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0 overflow-hidden">
            {account.profileImage ? (
              <img src={account.profileImage} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              getInitials(account.fullName)
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{account.fullName}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">{account.loginId}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
        {account.role === 'student' ? t('roleStudent') : t('roleTeacher')}
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
        {account.lastLogout ? new Date(account.lastLogout).toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
            title={t('view')}
            onClick={() => setViewAccount(account)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
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
                type: 'status',
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

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {Math.min(totalAccounts, (currentPage - 1) * ITEMS_PER_PAGE + 1)}&ndash;
          {Math.min(currentPage * ITEMS_PER_PAGE, totalAccounts)} {t('of')} {totalAccounts}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {t('previous')}
          </button>
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentPage === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('allAccounts')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('allAccountsSubtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/admin/accounts/create')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" />
          {t('createAccount')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={UsersIcon} label={t('totalAccounts')} value={totalAccounts} color="blue" />
        <StatCard icon={ShieldCheckIcon} label={t('activeAccounts')} value={totalActive} color="green" />
        <StatCard icon={NoSymbolIcon} label={t('inactiveAccounts')} value={totalInactive} color="yellow" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-start flex-wrap md:gap-4">
        <div className="w-full md:flex-1">
          <SearchInput placeholder={t('searchAccounts')} value={search} onChange={(v) => { setSearch(v); setCurrentPage(1); }} />
        </div>
        <div className="w-full sm:w-40">
          <SelectInput label={t('userType')} name="roleFilter" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }} options={roleOptions} />
        </div>
        <div className="w-full sm:w-44">
          <SelectInput label={t('accountStatus')} name="statusFilter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} options={statusOptions} />
        </div>
        <div className="w-full sm:w-44">
          <SelectInput label={t('profileStatus')} name="profileStatusFilter" value={profileStatusFilter} onChange={(e) => { setProfileStatusFilter(e.target.value); setCurrentPage(1); }} options={profileStatusOptions} />
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer md:mt-6"
        >
          {t('reset')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t('loadingAccounts')}</p>
        </div>
      ) : (
        <Table columns={tableColumns} data={accounts} renderRow={renderTableRow} />
      )}

      {!loading && renderPagination()}

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

      <Modal isOpen={!!viewAccount} onClose={() => setViewAccount(null)} title={t('accountDetails')} maxWidth="max-w-lg">
        {viewAccount && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm ring-1 ring-yellow-400/50 overflow-hidden">
                {viewAccount.profileImage ? (
                  <img src={viewAccount.profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  getInitials(viewAccount.fullName)
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{viewAccount.fullName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{viewAccount.email || viewAccount.phone || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('loginIdLabel')}</p>
                <p className="font-medium text-gray-900 dark:text-white font-mono">{viewAccount.loginId}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('userType')}</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {viewAccount.role === 'student' ? t('roleStudent') : t('roleTeacher')}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('accountStatus')}</p>
                <AccountStatusBadge status={viewAccount.accountStatus} />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('profileStatus')}</p>
                <ProfileStatusBadge status={viewAccount.profileStatus} />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('lastLogin')}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {viewAccount.lastLogin ? new Date(viewAccount.lastLogin).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('lastLogout')}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {viewAccount.lastLogout ? new Date(viewAccount.lastLogout).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">{t('createdDate')}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {viewAccount.createdAt ? new Date(viewAccount.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AllAccounts;