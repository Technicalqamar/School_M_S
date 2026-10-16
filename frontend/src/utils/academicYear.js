import { useCallback, useState } from 'react';

/**
 * Central Academic Year helper.
 *
 * Format: the project stores an Academic Year as a single 4-digit calendar year
 * (e.g. "2026"). This matches the backend:
 *   - `schoolSettings.model.js` → `currentAcademicYear` (String)
 *   - `schoolSettings.validation.js` → `/^\d{4}$/`
 *   - every `*.service.js` helper → `settings.currentAcademicYear` when valid,
 *     otherwise the current calendar year.
 *
 * School Settings is the single source of truth. A normal (new-entry / current)
 * Academic Year dropdown must therefore show ONLY the configured year — not a
 * list of historical years and never future years.
 *
 * Historical views (attendance history, filters, editing an existing record)
 * may additionally show years that actually exist in the data. Those years are
 * passed in explicitly via `extraYears`; the helper never fabricates an
 * arbitrary range.
 */
export const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

/**
 * Resolve the "current" Academic Year:
 * School Settings `currentAcademicYear` when it is a valid 4-digit year,
 * otherwise the current calendar year.
 */
export const resolveCurrentAcademicYear = (configuredYear) => {
  const configured =
    typeof configuredYear === 'string' ? configuredYear.trim() : String(configuredYear ?? '').trim();
  return ACADEMIC_YEAR_REGEX.test(configured) ? configured : String(new Date().getFullYear());
};

/**
 * Academic Year dropdown options.
 *
 * Always contains the resolved current year. `extraYears` (record years that
 * really exist, e.g. from a database result) are added only when they are valid
 * 4-digit years and not in the future. Sorted newest first.
 *
 * With no `extraYears` the result is a single option — the configured/current
 * year — which is the required behaviour for a normal current-year dropdown.
 *
 * @param {string|undefined} configuredYear School Settings current academic year
 * @param {Array<string|number>} [extraYears] existing years to also offer
 * @returns {string[]}
 */
export const getAcademicYearOptions = (configuredYear, extraYears = []) => {
  const current = Number(resolveCurrentAcademicYear(configuredYear));
  const years = new Set([String(current)]);

  (Array.isArray(extraYears) ? extraYears : []).forEach((value) => {
    const year = value === null || value === undefined ? '' : String(value).trim();
    // Valid 4-digit years only, and never a future year.
    if (ACADEMIC_YEAR_REGEX.test(year) && Number(year) <= current) {
      years.add(year);
    }
  });

  return [...years].sort((a, b) => Number(b) - Number(a));
};

/** Backwards-compatible alias for a normal (current-only) dropdown. */
export const getCurrentAcademicYearOptions = (configuredYear) => getAcademicYearOptions(configuredYear);

/**
 * Convenience hook for Academic Year form controls.
 *
 * The selected value defaults to the resolved current Academic Year and keeps
 * following School Settings until the user picks a value. Options are the
 * configured year only, plus any `extraYears` the caller needs (e.g. the year
 * stored on the record being edited).
 */
export const useAcademicYear = (configuredYear, extraYears = []) => {
  const resolved = resolveCurrentAcademicYear(configuredYear);
  // `null` means "the user has not picked a year yet" — while untouched the
  // value follows School Settings / the calendar year automatically.
  const [picked, setPicked] = useState(null);
  const year = picked === null ? resolved : picked;

  const setYear = useCallback((value) => setPicked(value), []);

  return { year, setYear, options: getAcademicYearOptions(configuredYear, extraYears) };
};

export default getAcademicYearOptions;
