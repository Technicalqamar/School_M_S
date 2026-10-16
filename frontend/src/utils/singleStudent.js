// Pure helpers for the Single Student Management workspace routes.
//
// The workspace lives under the shared Admin shell under both namespaces
// (`/admin/students/:studentId/...` and `/receptionist/students/:studentId/...`).
// The sidebar and the student context need to know, from the current URL
// alone, *which* student is selected and which portal namespace is active -
// without duplicating the router tree or trusting a mutable global. These
// helpers centralise that parsing so the sidebar, the context provider and the
// route guards all agree, and so the behaviour is unit-testable.

const STUDENT_PORTALS = ['admin', 'receptionist'];

// Parses a pathname into the single-student route it addresses.
// Returns null for anything that is not `/<portal>/students/<studentId>[/...]`
// (the students list itself has no id and is intentionally not matched).
export const parseStudentRoute = (pathname) => {
  if (typeof pathname !== 'string' || pathname.length === 0) return null;

  // Ignore query/hash and empty segments so trailing slashes are tolerated.
  const clean = pathname.split('?')[0].split('#')[0];
  const segments = clean.split('/').filter(Boolean);
  if (segments.length < 3) return null;

  const [portal, root, rawId, ...rest] = segments;
  if (!STUDENT_PORTALS.includes(portal)) return null;
  if (root !== 'students' || !rawId) return null;

  let studentId = rawId;
  try {
    studentId = decodeURIComponent(rawId);
  } catch {
    // Malformed encoding: keep the raw segment rather than throwing.
  }

  return {
    portal,
    basePath: `/${portal}`,
    studentId,
    section: rest.join('/'),
  };
};

// Builds a single-student route for a given portal. `portal` is normalised to
// one of the two supported namespaces so callers cannot accidentally emit a
// path outside the Admin shell.
export const buildStudentPath = (portal, studentId, section = '') => {
  const safePortal = STUDENT_PORTALS.includes(portal) ? portal : 'admin';
  const suffix = section ? `/${section}` : '';
  return `/${safePortal}/students/${encodeURIComponent(studentId)}${suffix}`;
};

// Builds the existing Attendance Management link that pre-selects a student:
// the class narrows the roster and the Student ID narrows it to the student.
// The existing attendance rules (academic year, class, date, status) are
// untouched - the attendance page still validates everything.
export const buildStudentAttendancePath = (portal, student) => {
  const base = portal === 'receptionist' ? '/receptionist' : '/admin';
  const params = new URLSearchParams();
  if (student?.class) params.set('class', student.class);
  if (student?.studentId) params.set('student', student.studentId);
  const query = params.toString();
  return `${base}/attendance${query ? `?${query}` : ''}`;
};

// True when the pathname is one of the two supported portal namespaces.
export const isStudentPortalPath = (pathname) => {
  const parsed = parseStudentRoute(pathname);
  return Boolean(parsed);
};
