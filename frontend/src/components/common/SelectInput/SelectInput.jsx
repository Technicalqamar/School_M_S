import { ChevronDownIcon } from '@heroicons/react/24/outline';

const optionLabel = (opt) => {
  if (typeof opt !== 'string') return String(opt);
  const separatorIndex = opt.indexOf('::');
  return separatorIndex === -1 ? opt : opt.slice(separatorIndex + 2);
};

const SelectInput = ({ label, name, value, onChange, options, placeholder = 'Select', required = false, disabled = false, className = '' }) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={`appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all ${
            disabled
              ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
          }`}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{optionLabel(opt)}</option>
          ))}
        </select>
        <ChevronDownIcon className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${disabled ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400'}`} />
      </div>
    </div>
  );
};

export default SelectInput;
