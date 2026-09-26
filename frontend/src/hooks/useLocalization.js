import { useSchoolConfig } from '../contexts/SchoolConfigContext';
import { formatTime } from '../utils/formatTime';
import { t as translate } from '../locales/index';

export const useFormatTime = () => {
  const { localization } = useSchoolConfig();
  const timeFormat = localization?.timeFormat || '12';
  return (date) => formatTime(date || new Date(), timeFormat);
};

export const useTranslation = () => {
  const { academic } = useSchoolConfig();
  const language = academic?.language || 'English';
  return { t: (key) => translate(key, language), language };
};

export const useCurrency = () => {
  const { localization } = useSchoolConfig();
  const symbol = localization?.currencySymbol || 'Rs.';
  return {
    currencySymbol: symbol,
    formatCurrency: (val) => {
      const n = Number(val);
      if (isNaN(n)) return `${symbol} 0`;
      return `${symbol} ${n.toLocaleString()}`;
    },
  };
};
