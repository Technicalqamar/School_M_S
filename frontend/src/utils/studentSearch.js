// Pure helpers for the Global Student Search (Admin Dashboard) and the
// Student Search inside Attendance Management.
//
// They are intentionally framework-free so they can be unit tested with the
// project's existing `node --test` setup and reused by any component. The
// backend already performs the authoritative search
// (`GET /students?search=` - case-insensitive `fullName`, `fatherName` and
// `studentId`), so these helpers only normalise input, describe a student and
// filter an already-loaded roster client-side.

// A term shorter than this is not worth a round trip; it would match most of
// the school and defeats the purpose of a focused suggestion list.
export const MIN_SEARCH_LENGTH = 2;

// Suggestions are capped so the dropdown stays scannable and the payload small.
export const SEARCH_SUGGESTION_LIMIT = 8;

// Trims the term the same way the backend does (`String(search).trim()`),
// which also covers leading/trailing whitespace typed by the user.
export const normalizeSearchTerm = (term) =>
  typeof term === 'string' ? term.trim() : '';

// True when the term is long enough to trigger a (debounced) request.
export const shouldSearch = (term, minLength = MIN_SEARCH_LENGTH) =>
  normalizeSearchTerm(term).length >= minLength;

// The exact request the suggestion list makes: a single page of matches,
// never the whole student database.
export const buildStudentSearchParams = (term, limit = SEARCH_SUGGESTION_LIMIT) => ({
  search: normalizeSearchTerm(term),
  page: 1,
  limit,
});

// A single, unambiguous label used to verify the selected student.
export const getStudentLabel = (student) => {
  const name = normalizeSearchTerm(student?.fullName);
  const id = normalizeSearchTerm(student?.studentId);
  if (name && id) return `${name} (${id})`;
  return name || id || '';
};

// Compact secondary line for a suggestion: class and Student ID.
export const getStudentMeta = (student) => {
  const parts = [];
  if (student?.class) parts.push(student.class);
  if (student?.studentId) parts.push(student.studentId);
  return parts.join(' · ');
};

export const getStudentInitials = (name) =>
  normalizeSearchTerm(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

// Case-insensitive substring match on full name or Student ID. Used to filter
// an already-loaded attendance roster in the browser.
export const filterStudentsByNameOrId = (students, term) => {
  if (!Array.isArray(students)) return [];
  const query = normalizeSearchTerm(term).toLowerCase();
  if (!query) return students;
  return students.filter((student) => {
    const name = (student?.fullName || '').toLowerCase();
    const id = (student?.studentId || '').toLowerCase();
    return name.includes(query) || id.includes(query);
  });
};
