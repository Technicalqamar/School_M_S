import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { KeyIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import userAccountService from '../../../services/userAccount/userAccount.service';

const MIN_LENGTH = 6;
const FIELDS = ['student', 'teacher'];

const emptyValues = { student: '', teacher: '' };

// Admin-configurable default passwords used for automatically created portal
// accounts. Receptionists are not part of this flow (their password is set
// manually by an Admin at creation in the Receptionist Management module), so
// there is no receptionist field here.
const DefaultPasswordsCard = () => {
  const { t } = useTranslation();
  const [values, setValues] = useState(emptyValues);
  const [saved, setSaved] = useState(emptyValues);
  const [configured, setConfigured] = useState({ student: false, teacher: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch the current settings once on mount. The request runs inside an
    // async IIFE so no state is set synchronously during the effect.
    (async () => {
      try {
        const res = await userAccountService.getDefaultPasswords();
        const data = res?.data || {};
        const next = { student: data.student || '', teacher: data.teacher || '' };
        setValues(next);
        setSaved(next);
        setConfigured({ student: Boolean(data.student), teacher: Boolean(data.teacher) });
      } catch (err) {
        toast.error(err.response?.data?.message || t('defaultPasswordsLoadError'));
      } finally {
        setLoading(false);
      }
    })();
    // Run only on mount; translations are applied at render time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    const newErrors = {};
    const payload = {};

    FIELDS.forEach((field) => {
      const value = values[field];
      // An empty field means "keep the current value" - it is not sent.
      if (value === '') return;
      if (value.length < MIN_LENGTH) {
        newErrors[field] = t('passwordMinLength');
        return;
      }
      payload[field] = value;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (Object.keys(payload).length === 0) {
      toast.error(t('defaultPasswordsNothingToSave'));
      return;
    }

    setSaving(true);
    try {
      const res = await userAccountService.updateDefaultPasswords(payload);
      const data = res?.data || {};
      const next = { student: data.student || '', teacher: data.teacher || '' };
      setValues(next);
      setSaved(next);
      setConfigured({ student: Boolean(data.student), teacher: Boolean(data.teacher) });
      setErrors({});
      toast.success(res?.message || t('defaultPasswordsSaved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('defaultPasswordsSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    values.student !== saved.student ||
    values.teacher !== saved.teacher;
  const busy = loading || saving;

  const renderField = (field, labelKey, notSetKey) => (
    <div>
      <Input
        label={t(labelKey)}
        name={field}
        type="password"
        value={values[field]}
        onChange={handleChange(field)}
        placeholder={t('defaultPasswordPlaceholder')}
        error={errors[field]}
        disabled={busy}
      />
      {!configured[field] && !values[field] && (
        <p className="-mt-2 mb-2 text-xs text-amber-600 dark:text-amber-400">{t(notSetKey)}</p>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('defaultPasswordsTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('defaultPasswordsSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mt-5">
        {renderField('student', 'studentDefaultPassword', 'studentDefaultPasswordNotSet')}
        {renderField('teacher', 'teacherDefaultPassword', 'teacherDefaultPasswordNotSet')}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('defaultPasswordsDirtyHint')}</p>
        <Button
          variant="primary"
          className="w-auto"
          onClick={handleSave}
          loading={saving}
          disabled={busy || !dirty}
        >
          {t('saveDefaultPasswords')}
        </Button>
      </div>
    </div>
  );
};

export default DefaultPasswordsCard;
