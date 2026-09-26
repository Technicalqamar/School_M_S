import { useState } from 'react';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';

const CURRENCIES = [
  'Pakistani Rupee', 'US Dollar', 'Euro', 'Pound Sterling', 'Indian Rupee',
  'Saudi Riyal', 'UAE Dirham', 'Bangladeshi Taka',
];
const CURRENCY_SYMBOLS = ['Rs.', '$', '€', '£', '₹', '﷼', 'د.إ', '৳'];
const LANGUAGES = ['English', 'Urdu', 'Arabic', 'French'];
const TIME_FORMATS = ['12', '24'];

const Localization = ({ data, onSave, saving }) => {
  const [form, setForm] = useState(() => ({ ...data }));
  const [editing, setEditing] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCurrencyChange = (e) => {
    if (!editing) return;
    const currency = e.target.value;
    const index = CURRENCIES.indexOf(currency);
    setForm((prev) => ({
      ...prev,
      currency,
      currencySymbol: index >= 0 ? CURRENCY_SYMBOLS[index] : prev.currencySymbol,
    }));
  };

  const handleEdit = () => {
    setForm({ ...data });
    setEditing(true);
  };

  const handleSave = async () => {
    await onSave(form);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <CardSection title="Currency & Display">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <SelectInput
            label="Currency"
            name="currency"
            value={form.currency}
            onChange={handleCurrencyChange}
            options={CURRENCIES}
            placeholder="Select currency"
            disabled={!editing}
          />
          <SelectInput
            label="Currency Symbol"
            name="currencySymbol"
            value={form.currencySymbol}
            onChange={handleChange('currencySymbol')}
            options={CURRENCY_SYMBOLS}
            placeholder="Select symbol"
            disabled={!editing}
          />
        </div>
      </CardSection>

      <CardSection title="Regional Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <SelectInput
            label="Default Language"
            name="defaultLanguage"
            value={form.defaultLanguage}
            onChange={handleChange('defaultLanguage')}
            options={LANGUAGES}
            placeholder="Select language"
            disabled={!editing}
          />
          <SelectInput
            label="Time Format"
            name="timeFormat"
            value={form.timeFormat}
            onChange={handleChange('timeFormat')}
            options={TIME_FORMATS}
            placeholder="Select format"
            disabled={!editing}
          />
        </div>
      </CardSection>

      <div className="flex items-center gap-3">
        {editing ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Information'}
          </button>
        ) : (
          <button
            onClick={handleEdit}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit Information
          </button>
        )}
      </div>
    </div>
  );
};

export default Localization;
