// ---------------------------------------------------------------------------
// Conversation state and menu text (Phase 3B).
//
// State is kept in memory on purpose: this phase must not add a new dependency
// or a database migration. The store is bounded, every entry expires, and the
// key is the normalized sender number, so one guardian can never drive another
// guardian's conversation.
//
// Child-selection numbers and main-menu numbers are interpreted in different
// stages: while a guardian is choosing a child, "1" means the first child; once
// a child is selected, "1" means Fee details.
// ---------------------------------------------------------------------------

const STAGE = {
  CHILD_SELECTION: 'child_selection',
  MAIN_MENU: 'main_menu',
};

const MENU = {
  FEES: 1,
  ATTENDANCE: 2,
  RESULTS: 3,
  MAIN_MENU: 4,
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1000;
const MAX_STUDENTS = 20;
const MAX_MESSAGE_LENGTH = 512;

const MAIN_MENU_TEXT = [
  'Please reply with a number:',
  '1. Fee details',
  '2. Attendance',
  '3. Exam results',
  '4. Main menu',
].join('\n');

const CHILD_PROMPT_TEXT =
  'This number is registered for more than one student. Please reply with the number of your child:';

const INVALID_INPUT_TEXT = 'That is not a valid choice.';

const PRIVACY_SAFE_TEXT =
  'This phone number is not registered with the school. Please contact the school office for help.';

const NOT_AVAILABLE_TEXT =
  'This information is not available yet. Please contact the school office.';

const formatStudentLabel = (student) => {
  if (!student) return 'your child';
  const name = String(student.fullName || '').trim();
  const className = String(student.class || '').trim();
  if (name && className) return `${name} (${className})`;
  return name || className || 'your child';
};

const formatChildList = (students) => {
  const list = Array.isArray(students) ? students : [];

  return list
    .map((student, index) => {
      const name = String(student?.fullName || '').trim() || `Student ${index + 1}`;
      const className = String(student?.class || '').trim();
      return `${index + 1}. ${name}${className ? ` (${className})` : ''}`;
    })
    .join('\n');
};

/**
 * Parse a single numbered reply. Accepts "2", "2." and "2)".
 * Returns the number when it is between 1 and `max`, otherwise null.
 */
const parseSelection = (text, max) => {
  if (typeof text !== 'string') return null;

  const match = text.trim().match(/^(\d{1,2})[.)]?$/);
  if (!match) return null;

  const value = Number(match[1]);
  const limit = Number(max);
  if (!Number.isInteger(value) || !Number.isInteger(limit)) return null;
  if (value < 1 || value > limit) return null;

  return value;
};

const parseMenuSelection = (text) => parseSelection(text, MENU.MAIN_MENU);

const parseChildSelection = (text, childCount) => parseSelection(text, childCount);

/**
 * Bounded, expiring conversation store keyed by the normalized sender number.
 * `get` returns a shallow copy so callers cannot mutate the stored state
 * without calling `set` again.
 */
const createConversationStore = ({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = () => Date.now(),
} = {}) => {
  // Insertion order equals expiry order: every `set` re-inserts the key, and
  // every entry receives the same TTL.
  const entries = new Map();
  const effectiveTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
  const effectiveMaxEntries =
    Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : DEFAULT_MAX_ENTRIES;

  const prune = (timestamp) => {
    for (const [key, state] of entries) {
      if (state.expiresAt > timestamp) break;
      entries.delete(key);
    }
  };

  const get = (key) => {
    if (typeof key !== 'string' || !key) return null;

    const state = entries.get(key);
    if (!state) return null;

    if (state.expiresAt <= now()) {
      entries.delete(key);
      return null;
    }

    return {
      ...state,
      students: Array.isArray(state.students)
        ? state.students.map((student) => ({ ...student }))
        : [],
    };
  };

  const set = (key, state) => {
    if (typeof key !== 'string' || !key) return false;

    const timestamp = now();
    prune(timestamp);

    entries.delete(key);
    entries.set(key, {
      ...state,
      sender: key,
      students: Array.isArray(state?.students)
        ? state.students.map((student) => ({ ...student }))
        : [],
      updatedAt: timestamp,
      expiresAt: timestamp + effectiveTtl,
    });

    while (entries.size > effectiveMaxEntries) {
      const oldestKey = entries.keys().next().value;
      entries.delete(oldestKey);
    }

    return true;
  };

  const remove = (key) => entries.delete(key);
  const size = () => entries.size;
  const clear = () => entries.clear();

  return { get, set, remove, size, clear };
};

export {
  STAGE,
  MENU,
  DEFAULT_TTL_MS,
  DEFAULT_MAX_ENTRIES,
  MAX_STUDENTS,
  MAX_MESSAGE_LENGTH,
  MAIN_MENU_TEXT,
  CHILD_PROMPT_TEXT,
  INVALID_INPUT_TEXT,
  PRIVACY_SAFE_TEXT,
  NOT_AVAILABLE_TEXT,
  formatStudentLabel,
  formatChildList,
  parseSelection,
  parseMenuSelection,
  parseChildSelection,
  createConversationStore,
};
