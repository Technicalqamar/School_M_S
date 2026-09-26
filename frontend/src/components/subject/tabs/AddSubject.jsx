import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import CardSection from '../../common/CardSection/CardSection';
import Input from '../../common/Input/Input';
import SelectInput from '../../common/SelectInput/SelectInput';
import Alert from '../../common/Alert/Alert';
import subjectService from '../../../services/subject/subject.service';

const initialState = {
  subjectName: '',
  subjectCode: '',
  description: '',
  status: 'Active',
};

const getInitialForm = (editData) => editData ? {
  subjectName: editData.subjectName || '',
  subjectCode: editData.subjectCode || '',
  description: editData.description || '',
  status: editData.status || 'Active',
} : initialState;

const AddSubject = ({ editData, onSuccess }) => {
  const { t } = useTranslation();
  const statusOptions = [t('active'), t('inactive')];
  const [form, setForm] = useState(() => getInitialForm(editData));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const resetForm = () => {
    setForm(getInitialForm(editData));
    setError('');
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      if (editData) {
        await subjectService.updateSubject(editData._id, {
          subjectName: form.subjectName,
          description: form.description,
          status: form.status,
        });
        toast.success(t('updatedSuccessfully'));
      } else {
        const result = await subjectService.createSubject({
          subjectName: form.subjectName,
          description: form.description,
          status: form.status,
        });
        toast.success(t('savedSuccessfully'));
        setForm({ ...initialState, subjectCode: result.data?.subject?.subjectCode || '' });
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToSave');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (editData) {
      setForm({
        subjectName: editData.subjectName || '',
        subjectCode: editData.subjectCode || '',
        description: editData.description || '',
        status: editData.status || 'Active',
      });
      setError('');
    } else {
      resetForm();
    }
  };

  return (
    <div className="space-y-5">
      {error && <Alert message={error} type="error" />}

      <div className="max-w-2xl">
        <CardSection title={editData ? t('addSubject') : t('subject')}>
          <Input
            label={t('subjectName')}
            name="subjectName"
            value={form.subjectName}
            onChange={handleChange('subjectName')}
            placeholder={t('subjectName')}
          />
          <Input
            label={t('subjectCode')}
            name="subjectCode"
            value={form.subjectCode}
            disabled
            placeholder={t('notAvailable')}
          />
          <SelectInput
            label={t('status')}
            name="status"
            value={form.status}
            onChange={handleChange('status')}
            options={statusOptions}
          />
          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('description')}
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange('description')}
              rows={4}
              placeholder={t('description')}
              className="appearance-none block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>
        </CardSection>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2.5 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('saving') : editData ? t('update') : t('save')}
        </button>
      </div>
    </div>
  );
};

export default AddSubject;
