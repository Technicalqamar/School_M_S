// ---------------------------------------------------------------------------
// Guardian matching helpers (Phase 3B).
//
// Guardian identity always comes from the phone number that the provider signed
// the webhook with. Nothing supplied inside the message text is ever used as an
// identity signal.
//
// Stored student records are NOT modified. Incoming and stored numbers are both
// normalized to the same canonical form (92 + 10 national digits) before any
// comparison, and a permissive, anchored query pattern is used so the common
// Pakistani spellings (+92..., 0092..., 0..., bare) all match.
// ---------------------------------------------------------------------------

const CANONICAL_PATTERN = /^923\d{9}$/;

/**
 * Normalize a Pakistani mobile number to `92XXXXXXXXXX`.
 * Returns '' for anything that is not a plausible Pakistani mobile number
 * (landlines, short codes, group JIDs, random identifiers).
 *
 * Accepted examples:
 *   +92 300 1234567 / 0092-300-1234567 / 923001234567 / 0300-1234567 /
 *   03001234567 / 3001234567 / 923001234567@s.whatsapp.net
 */
const normalizePakistaniPhone = (value) => {
  let text = null;

  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);

  if (!text) return '';

  text = text.trim();
  if (!text) return '';

  // WhatsApp JIDs ("923001234567@s.whatsapp.net") and device suffixes
  // ("923001234567:12@...") are reduced to the number part.
  const atIndex = text.indexOf('@');
  if (atIndex > 0) text = text.slice(0, atIndex);
  const colonIndex = text.indexOf(':');
  if (colonIndex > 0) text = text.slice(0, colonIndex);

  text = text.trim();
  if (!text) return '';

  // After the JID suffix is removed, only phone characters may remain. This
  // rejects arbitrary identifiers that merely contain a valid-looking number.
  if (!/^[\d\s+\-().]+$/.test(text)) return '';

  let digits = text.replace(/\D/g, '');
  if (!digits) return '';

  // International dialing prefix.
  if (digits.startsWith('0092')) digits = digits.slice(2);

  if (digits.startsWith('0') && digits.length === 11) {
    digits = `92${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = `92${digits}`;
  }

  if (!CANONICAL_PATTERN.test(digits)) return '';

  return digits;
};

/**
 * Build an anchored query pattern for a canonical number.
 *
 * Every digit is separated by an optional separator so the stored formatting
 * ("0300-1234567", "+92 300 1234567", ...) does not matter. The pattern only
 * contains digits and separator classes, so it cannot be used for regex
 * injection. Matching is still re-verified in JavaScript after the query, so a
 * permissive stored value can never produce a false guardian match.
 */
const buildGuardianPhoneRegex = (value) => {
  const canonical = normalizePakistaniPhone(value);
  if (!canonical) return null;

  const national = canonical.slice(2);
  const separatedDigits = national.split('').join('[\\s\\-.]*');
  const source = `^\\s*(?:\\+?92|0092|0)?[\\s\\-.]*${separatedDigits}\\s*$`;

  return new RegExp(source);
};

/**
 * Minimal, non-sensitive student representation used in menus and state.
 * Phone numbers and other personal fields are deliberately not included.
 */
const toStudentSummary = (doc) => ({
  id: doc?._id ? String(doc._id) : '',
  studentId: doc?.studentId ? String(doc.studentId) : '',
  fullName: doc?.fullName ? String(doc.fullName) : '',
  class: doc?.class ? String(doc.class) : '',
});

/**
 * Resolve a set of candidate students to a single match outcome.
 * Kept pure so the "none / one / many" rule is unit testable without a DB.
 */
const resolveMatchOutcome = (students) => {
  const list = Array.isArray(students) ? students.filter((student) => student && student.id) : [];

  if (list.length === 0) return { outcome: 'none', student: null };
  if (list.length === 1) return { outcome: 'single', student: list[0] };

  return { outcome: 'multiple', student: null };
};

export {
  CANONICAL_PATTERN,
  normalizePakistaniPhone,
  buildGuardianPhoneRegex,
  toStudentSummary,
  resolveMatchOutcome,
};
