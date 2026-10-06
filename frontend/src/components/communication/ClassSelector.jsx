import { CLASS_NAMES } from '../../utils/classNames';

const ClassSelector = ({ value = [], onChange, disabled = false }) => {
  const toggle = (cn) => {
    if (disabled) return;
    if (value.includes(cn)) {
      onChange(value.filter((c) => c !== cn));
    } else {
      onChange([...value, cn]);
    }
  };

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 transition-opacity ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {CLASS_NAMES.map((cn) => (
        <label
          key={cn}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer ${
            value.includes(cn)
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(cn)}
            onChange={() => toggle(cn)}
            className="h-3.5 w-3.5 text-blue-600 rounded"
          />
          {cn}
        </label>
      ))}
    </div>
  );
};

export default ClassSelector;