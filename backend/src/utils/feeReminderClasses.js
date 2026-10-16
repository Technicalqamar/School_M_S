// Pure helpers for selecting which classes a class-wise fee reminder may target.
//
// Kept free of any model/DB import so it can be unit-tested on its own, exactly
// like `feeReminderTemplate.js`. The one rule it encodes: a requested class is
// either a real class from the Student model's enum (which keeps the space in
// `KG 1` / `KG 2`) or it is rejected outright - the server never silently drops
// an unknown class, because that would make the eligible count the caller saw
// differ from what the server actually processed.

// The only classes a reminder send may target.
export const FEE_REMINDER_CLASSES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

export const isValidClassName = (name) => FEE_REMINDER_CLASSES.includes(name);

/**
 * Accepts either an array (JSON body) or a comma-separated string (query string),
 * trims every entry and removes blanks/duplicates, so the same class can never
 * be requested twice. Anything else resolves to an empty list.
 */
export const normalizeClassNames = (value) => {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(list.map((entry) => String(entry).trim()).filter(Boolean))];
};

/**
 * Resolves the requested class list from either `classNames` (multi) or the
 * legacy single `className`, so older callers keep working unchanged.
 */
export const resolveRequestedClasses = ({ classNames, className } = {}) => {
  const fromList = normalizeClassNames(classNames);
  return fromList.length ? fromList : normalizeClassNames(className);
};

/**
 * Returns the requested classes that do not exist (empty when all are valid).
 */
export const getInvalidClassNames = (classes) =>
  normalizeClassNames(classes).filter((name) => !isValidClassName(name));

export default {
  FEE_REMINDER_CLASSES,
  isValidClassName,
  normalizeClassNames,
  resolveRequestedClasses,
  getInvalidClassNames,
};
