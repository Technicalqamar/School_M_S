import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  STAGE,
  MENU,
  DEFAULT_TTL_MS,
  MAIN_MENU_TEXT,
  MAX_STUDENTS,
  formatStudentLabel,
  formatChildList,
  parseSelection,
  parseMenuSelection,
  parseChildSelection,
  createConversationStore,
} from '../../../src/services/whatsapp/whatsappConversation.core.js';

// ---------------------------------------------------------------------------
// Menu parsing and conversation-state tests. No I/O.
// ---------------------------------------------------------------------------

const student = (id, fullName, className = 'Class 1') => ({
  id,
  studentId: `STD-${id}`,
  fullName,
  class: className,
});

describe('menu text', () => {
  it('contains the four documented options and nothing else numbered', () => {
    assert.match(MAIN_MENU_TEXT, /1\. Fee details/);
    assert.match(MAIN_MENU_TEXT, /2\. Attendance/);
    assert.match(MAIN_MENU_TEXT, /3\. Exam results/);
    assert.match(MAIN_MENU_TEXT, /4\. Main menu/);
    assert.deepEqual(MENU, { FEES: 1, ATTENDANCE: 2, RESULTS: 3, MAIN_MENU: 4 });
  });

  it('formats a child label with an optional class', () => {
    assert.equal(formatStudentLabel(student('1', 'Ali Khan', 'Class 3')), 'Ali Khan (Class 3)');
    assert.equal(formatStudentLabel({ fullName: 'Ali Khan' }), 'Ali Khan');
    assert.equal(formatStudentLabel({ class: 'Class 3' }), 'Class 3');
    assert.equal(formatStudentLabel(null), 'your child');
  });

  it('numbers the child list independently of the main menu', () => {
    const text = formatChildList([
      student('1', 'Ali Khan', 'Class 3'),
      student('2', 'Ayesha Khan', 'Class 5'),
    ]);

    assert.equal(text, '1. Ali Khan (Class 3)\n2. Ayesha Khan (Class 5)');
  });
});

describe('selection parsing', () => {
  it('accepts the documented menu numbers', () => {
    assert.equal(parseMenuSelection('1'), 1);
    assert.equal(parseMenuSelection('2'), 2);
    assert.equal(parseMenuSelection('3'), 3);
    assert.equal(parseMenuSelection('4'), 4);
    assert.equal(parseMenuSelection(' 2 '), 2);
    assert.equal(parseMenuSelection('2.'), 2);
    assert.equal(parseMenuSelection('2)'), 2);
  });

  it('rejects anything that is not a menu number', () => {
    for (const value of ['0', '5', '99', '1.5', '-1', 'abc', '', '   ', 'STD-001', '03001234567']) {
      assert.equal(parseMenuSelection(value), null, `expected rejection for ${value}`);
    }

    assert.equal(parseMenuSelection(null), null);
    assert.equal(parseMenuSelection(undefined), null);
    assert.equal(parseMenuSelection(2), null);
  });

  it('bounds child selection by the actual child count', () => {
    assert.equal(parseChildSelection('1', 3), 1);
    assert.equal(parseChildSelection('3', 3), 3);
    assert.equal(parseChildSelection('4', 3), null);
    assert.equal(parseChildSelection('0', 3), null);
    assert.equal(parseChildSelection('1', 0), null);
    assert.equal(parseChildSelection('abc', 3), null);
  });

  it('never treats a long identifier as a selection', () => {
    assert.equal(parseSelection('12', 20), 12);
    assert.equal(parseSelection('100', 20), null);
    assert.equal(parseSelection('1 2', 20), null);
  });
});

describe('conversation store', () => {
  it('stores and reads state per sender', () => {
    const store = createConversationStore();
    const first = student('1', 'Ali Khan');
    const second = student('2', 'Ayesha Khan');

    store.set('923001234567', {
      stage: STAGE.MAIN_MENU,
      students: [first],
      selectedStudentId: first.id,
    });
    store.set('923009999999', {
      stage: STAGE.CHILD_SELECTION,
      students: [second],
      selectedStudentId: null,
    });

    assert.equal(store.get('923001234567').selectedStudentId, first.id);
    assert.equal(store.get('923009999999').selectedStudentId, null);
    assert.equal(store.get('923001111111'), null);
    assert.equal(store.size(), 2);
  });

  it('records the sender on the state so a key can never be reused by accident', () => {
    const store = createConversationStore();
    store.set('923001234567', { stage: STAGE.MAIN_MENU, students: [], selectedStudentId: null });

    assert.equal(store.get('923001234567').sender, '923001234567');
  });

  it('expires state after the TTL and removes it lazily', () => {
    let now = 1_000_000;
    const store = createConversationStore({ ttlMs: 1000, now: () => now });

    store.set('923001234567', { stage: STAGE.MAIN_MENU, students: [], selectedStudentId: null });
    now = 1_000_999;
    assert.ok(store.get('923001234567'));

    now = 1_001_000;
    assert.equal(store.get('923001234567'), null);
    assert.equal(store.size(), 0);
  });

  it('refreshes the expiry when the state is updated', () => {
    let now = 1_000_000;
    const store = createConversationStore({ ttlMs: 1000, now: () => now });

    store.set('923001234567', { stage: STAGE.CHILD_SELECTION });
    now = 1_000_900;
    store.set('923001234567', { stage: STAGE.MAIN_MENU });

    now = 1_001_500;
    assert.equal(store.get('923001234567').stage, STAGE.MAIN_MENU);

    now = 1_001_900;
    assert.equal(store.get('923001234567'), null);
  });

  it('evicts the oldest entry when the size cap is reached', () => {
    const store = createConversationStore({ maxEntries: 2 });

    store.set('a', { stage: STAGE.MAIN_MENU });
    store.set('b', { stage: STAGE.MAIN_MENU });
    store.set('c', { stage: STAGE.MAIN_MENU });

    assert.equal(store.size(), 2);
    assert.equal(store.get('a'), null);
    assert.ok(store.get('b'));
    assert.ok(store.get('c'));
  });

  it('returns a copy so callers cannot mutate stored state without set()', () => {
    const store = createConversationStore();
    store.set('923001234567', {
      stage: STAGE.CHILD_SELECTION,
      students: [student('1', 'Ali Khan')],
      selectedStudentId: null,
    });

    const read = store.get('923001234567');
    read.stage = STAGE.MAIN_MENU;
    read.students.push(student('2', 'Ayesha Khan'));
    read.students[0].fullName = 'Changed';

    const reread = store.get('923001234567');
    assert.equal(reread.stage, STAGE.CHILD_SELECTION);
    assert.equal(reread.students.length, 1);
    assert.equal(reread.students[0].fullName, 'Ali Khan');
  });

  it('removes and clears state without touching other keys', () => {
    const store = createConversationStore();
    store.set('a', { stage: STAGE.MAIN_MENU });
    store.set('b', { stage: STAGE.MAIN_MENU });

    store.remove('a');
    assert.equal(store.get('a'), null);
    assert.ok(store.get('b'));

    store.clear();
    assert.equal(store.size(), 0);
  });

  it('uses a 15-minute default TTL and a bounded student list', () => {
    assert.equal(DEFAULT_TTL_MS, 15 * 60 * 1000);
    assert.ok(MAX_STUDENTS > 0 && MAX_STUDENTS <= 50);
  });
});
