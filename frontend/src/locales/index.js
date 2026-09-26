import en from './en.js';
import ur from './ur.js';
import ar from './ar.js';
import fr from './fr.js';

const LOCALE_MAP = {
  English: en,
  Urdu: ur,
  Arabic: ar,
  French: fr,
};

const getTranslations = (language) => {
  return LOCALE_MAP[language] || en;
};

export const t = (key, language) => {
  const translations = getTranslations(language);
  return translations[key] || key;
};

export const getDir = (language) => {
  if (language === 'Urdu' || language === 'Arabic') return 'rtl';
  return 'ltr';
};

export { en, ur, ar, fr };
export default { t, getDir, getTranslations };
