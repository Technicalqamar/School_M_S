// Focused tests for the class-selection helpers used by the class-wise Fee
// Reminders page.
//
// The page can now target one OR several classes. These are pure functions (no
// DB, no models), so they pin the exact contract the backend relies on: a class
// is either a real class or the whole request is rejected, and a selection is
// de-duplicated so a multi-class send can never process the same class twice.

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FEE_REMINDER_CLASSES,
  isValidClassName,
  normalizeClassNames,
  resolveRequestedClasses,
  getInvalidClassNames,
} = await import('../src/utils/feeReminderClasses.js');

test('the selectable classes are exactly the 14 school classes', () => {
  assert.equal(FEE_REMINDER_CLASSES.length, 14);
  // KG 1 / KG 2 keep the space, matching the Student model's class enum.
  assert.deepEqual(FEE_REMINDER_CLASSES.slice(0, 4), ['Montessori', 'Nursery', 'KG 1', 'KG 2']);
  assert.deepEqual(FEE_REMINDER_CLASSES.slice(4), [
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  ]);
  assert.equal(new Set(FEE_REMINDER_CLASSES).size, 14);
});

test('normalizeClassNames accepts an array or a comma string and trims blanks', () => {
  assert.deepEqual(normalizeClassNames(['Class 1', 'Class 2']), ['Class 1', 'Class 2']);
  assert.deepEqual(normalizeClassNames('Class 1, Class 2 ,  Class 3 '), [
    'Class 1',
    'Class 2',
    'Class 3',
  ]);
  assert.deepEqual(normalizeClassNames('Class 1,,Class 1'), ['Class 1']);
  assert.deepEqual(normalizeClassNames(undefined), []);
  assert.deepEqual(normalizeClassNames(''), []);
});

test('normalizeClassNames removes duplicates so a class is processed once', () => {
  assert.deepEqual(normalizeClassNames(['Class 7', 'Class 7', 'Class 9', 'Class 7']), [
    'Class 7',
    'Class 9',
  ]);
});

test('resolveRequestedClasses prefers classNames and falls back to the legacy className', () => {
  assert.deepEqual(resolveRequestedClasses({ classNames: ['Class 5', 'Class 6'] }), [
    'Class 5',
    'Class 6',
  ]);
  // Legacy single-class callers keep working unchanged.
  assert.deepEqual(resolveRequestedClasses({ className: 'Class 4' }), ['Class 4']);
  // An empty classNames list must not shadow a supplied className.
  assert.deepEqual(resolveRequestedClasses({ classNames: [], className: 'Nursery' }), ['Nursery']);
  assert.deepEqual(resolveRequestedClasses({}), []);
});

test('an unknown class is reported so the whole request can be rejected', () => {
  assert.deepEqual(getInvalidClassNames(['Class 1', 'Class 11']), ['Class 11']);
  assert.deepEqual(getInvalidClassNames(['Montessori', 'KG 1']), []);
  // The un-spaced spellings are not real classes here.
  assert.deepEqual(getInvalidClassNames(['KG1', 'KG2']), ['KG1', 'KG2']);
  assert.equal(isValidClassName('KG 2'), true);
  assert.equal(isValidClassName('KG2'), false);
});
