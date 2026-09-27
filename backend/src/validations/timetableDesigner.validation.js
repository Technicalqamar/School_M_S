import { ApiError } from '../utils/apiError.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;
const VALID_GROUPS = [1, 2, 3];

// Designer query params are optional: academicYear defaults to the central
// school setting, and omitting `group` returns all three group blocks.
// This middleware only validates — it never rewrites req.query (which is a
// read-only getter in Express 5). The service applies the same rules when it
// resolves the filters.
const validateTimetableDesignerQuery = (req, res, next) => {
  const { academicYear, group } = req.query;

  if (academicYear !== undefined && academicYear !== null && String(academicYear).trim() !== '') {
    const year = String(academicYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(year)) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }
  }

  if (group !== undefined && group !== null && String(group).trim() !== '') {
    const groupNumber = Number(group);
    if (!VALID_GROUPS.includes(groupNumber)) {
      throw new ApiError(400, 'Invalid group. Allowed: 1, 2, 3');
    }
  }

  next();
};

export { validateTimetableDesignerQuery };