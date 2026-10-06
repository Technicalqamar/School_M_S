// Frontend-only wrong-role ID protection for the login forms.
// This is a UX guard that saves a pointless API round-trip: it never replaces
// backend authentication, password validation or role authorization, and IDs
// that do not match these prefixes are always sent to the backend unchanged.

const STUDENT_ID_PATTERN = /^(STU|STD)/i;
const TEACHER_ID_PATTERN = /^TCH/i;

/**
 * Returns the user-facing message when the typed ID clearly belongs to the
 * other portal, or null when the ID should be sent to the backend as-is.
 *
 * @param {string} value - raw ID typed by the user
 * @param {'teacher' | 'student'} portal - login form the ID was typed into
 * @returns {string | null}
 */
export const getWrongRoleIdMessage = (value, portal) => {
  const id = (value || '').trim();

  if (portal === 'teacher' && STUDENT_ID_PATTERN.test(id)) {
    return 'This is a Student ID. Please switch to Student Login.';
  }

  if (portal === 'student' && TEACHER_ID_PATTERN.test(id)) {
    return 'This is a Teacher ID. Please switch to Teacher Login.';
  }

  return null;
};

export default getWrongRoleIdMessage;
