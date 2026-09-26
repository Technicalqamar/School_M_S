import { useState } from 'react';
import toast from 'react-hot-toast';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';
import Input from '../../common/Input/Input';
import SelectInput from '../../common/SelectInput/SelectInput';
import Button from '../../common/Button/Button';
import SearchUserInput from './SearchUserInput';
import userAccountService from '../../../services/userAccount/userAccount.service';

const DEFAULT_PASSWORD = '12345678';

const CreateAccount = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    userType: '',
    password: DEFAULT_PASSWORD,
    confirmPassword: DEFAULT_PASSWORD,
    accountStatus: `Active::${t('statusActive')}`,
  }));
  const [selectedUser, setSelectedUser] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'userType') {
      setSelectedUser(null);
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleAutoGenerate = () => {
    const password = String(Math.floor(10000000 + Math.random() * 90000000));
    setForm((prev) => ({ ...prev, password, confirmPassword: password }));
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: '' }));
    }
    if (errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
    }
  };

  const resetForm = () => {
    setForm({
      userType: '',
      password: DEFAULT_PASSWORD,
      confirmPassword: DEFAULT_PASSWORD,
      accountStatus: `Active::${t('statusActive')}`,
    });
    setSelectedUser(null);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!selectedRole) newErrors.userType = t('fieldRequired');
    if (!selectedUser) newErrors.selectedUser = t('fieldRequired');
    if (!form.password) newErrors.password = t('fieldRequired');
    if (form.password && form.password.length < 6) newErrors.password = t('passwordMinLength');
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) newErrors.confirmPassword = t('passwordMismatch');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await userAccountService.createAccount({
        role: selectedRole,
        referenceId: selectedUser._id,
        password: form.password,
        isActive: selectedStatusValue === 'Active',
      });
      toast.success(t('accountCreated'));
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) {
        toast.error(msg);
      } else {
        toast.error(t('accountAlreadyExists'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [`Active::${t('statusActive')}`, `Inactive::${t('statusInactive')}`];

  const USER_TYPES = [`student::${t('roleStudent')}`, `teacher::${t('roleTeacher')}`];

  const selectedRole = form.userType ? form.userType.split('::')[0] : '';
  const selectedStatusValue = form.accountStatus ? form.accountStatus.split('::')[0] : 'Active';

  const loginIdValue = selectedUser ? selectedUser.profileId : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('createAccount')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('createAccountSubtitle')}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <SelectInput
              label={t('userType')}
              name="userType"
              value={form.userType}
              onChange={handleChange}
              options={USER_TYPES}
              placeholder={t('selectUserType')}
              required
            />
            {errors.userType && <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-2">{errors.userType}</p>}

            <div className="md:col-span-2">
              <SearchUserInput
                userType={selectedRole}
                selectedUser={selectedUser}
                onSelect={setSelectedUser}
                error={errors.selectedUser}
              />
            </div>

            <Input
              label={t('loginIdLabel')}
              name="loginId"
              value={loginIdValue}
              onChange={() => {}}
              placeholder={t('loginIdPlaceholder')}
              disabled
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('password')} <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  {t('autoGenerate')}
                </button>
              </div>
              <Input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                error={errors.password}
                placeholder={t('enterPassword')}
              />
            </div>

            <Input
              label={t('confirmPassword')}
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              error={errors.confirmPassword}
              placeholder={t('confirmPasswordPlaceholder')}
            />

            <SelectInput
              label={t('accountStatus')}
              name="accountStatus"
              value={form.accountStatus}
              onChange={handleChange}
              options={statusOptions}
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={resetForm} className="w-auto" disabled={submitting}>
              {t('reset')}
            </Button>
            <Button type="submit" variant="primary" className="w-auto" loading={submitting}>
              {t('createAccount')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAccount;