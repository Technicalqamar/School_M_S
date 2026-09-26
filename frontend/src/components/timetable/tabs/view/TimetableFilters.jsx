import { useTranslation } from '../../../../hooks/useLocalization';
import SelectInput from '../../../common/SelectInput/SelectInput';

const TimetableFilters = ({ filters, onFilterChange }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        {filters.map((filter) => (
          <div key={filter.name} className="w-full sm:w-56">
            <SelectInput
              label={filter.label}
              name={filter.name}
              value={filter.value}
              onChange={(e) => onFilterChange(filter.name, e.target.value)}
              options={filter.options}
              placeholder={filter.placeholder || `${t('select')} ${filter.label.toLowerCase()}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimetableFilters;
