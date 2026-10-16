// Focused tests for the removed `Mark.isPass` virtual.
//
// Root cause being pinned: `Mark` never had a `passingMarks` field. The old
// `isPass` virtual read `this.passingMarks` (always `undefined`), so
// `!this.passingMarks || ...` short-circuited to `true` and EVERY mark reported
// as passed. The virtual was also never consumed and never serialized
// (mark queries use `.lean()`, and no `virtuals: true` is configured), which is
// why it was a silent trap rather than a visible failure.
//
// Pass/fail is decided by the exam-subject configuration instead
// (ExamSubject.passingMarks) inside result.service.js -> buildSubjectResult.
// These tests pin both halves: the broken virtual is gone, and the real rule is
// still `obtainedMarks >= config.passingMarks` and independent of the Mark.
//
// DB-less: the schema is inspected directly and `buildSubjectResult` is a pure
// function, so no database connection is required.

import test from 'node:test';
import assert from 'node:assert/strict';

const { default: Mark } = await import('../src/models/mark.model.js');
const { buildSubjectResult } = await import('../src/services/result.service.js');

const validMarkAttrs = () => ({
  examId: '507f1f77bcf86cd799439011',
  studentId: '507f1f77bcf86cd799439012',
  subjectId: '507f1f77bcf86cd799439013',
  academicYear: '2025',
  className: 'Class 5',
  obtainedMarks: 30,
});

test('Mark schema no longer defines the stale isPass virtual', () => {
  assert.equal(Mark.schema.virtuals.isPass, undefined);
});

test('Mark schema has no passingMarks path (the field the old virtual read)', () => {
  assert.equal(Mark.schema.path('passingMarks'), undefined);
});

test('a Mark instance does not surface an always-true isPass', () => {
  const doc = new Mark(validMarkAttrs());

  // The old virtual returned `true` for every document. It must now be absent.
  assert.equal(doc.isPass, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(doc, 'isPass'), false);
});

test('a failing mark (obtained < total) is not reported as passing via the model', () => {
  // obtained 30 / total 100 would be a fail under any sane rule, but the old
  // virtual still returned true. Confirm nothing on the model invents a pass.
  const doc = new Mark({ ...validMarkAttrs(), totalMarks: 100 });
  assert.equal(doc.isPass, undefined);
});

test('isPass is not serialized into JSON (no virtuals are enabled)', () => {
  const json = new Mark(validMarkAttrs()).toJSON();
  assert.equal('isPass' in json, false);
  assert.equal('passingMarks' in json, false);
});

// ── The authoritative rule (unchanged, lives in the result service) ──────────

const config = (passingMarks) => ({
  subjectId: { subjectName: 'Mathematics', subjectCode: 'MATH' },
  totalMarks: 100,
  passingMarks,
});

test('pass/fail uses ExamSubject.passingMarks, not the Mark document', () => {
  const passed = buildSubjectResult(config(40), { obtainedMarks: 40, totalMarks: 100 });
  const failed = buildSubjectResult(config(40), { obtainedMarks: 39, totalMarks: 100 });

  assert.equal(passed.passed, true);
  assert.equal(failed.passed, false);
  assert.equal(passed.passingMarks, 40);
  assert.equal(failed.passingMarks, 40);
});

test('a Mark-level passingMarks property cannot influence the result', () => {
  // Even if a caller hands us an object carrying a bogus `passingMarks`, the
  // decision must come from the exam-subject config only.
  const withStaleField = buildSubjectResult(config(40), {
    obtainedMarks: 10,
    totalMarks: 100,
    passingMarks: 5,
  });

  assert.equal(withStaleField.passed, false);
  assert.equal(withStaleField.passingMarks, 40);
});

test('an unentered subject is never marked as passed', () => {
  const result = buildSubjectResult(config(40), null);
  assert.equal(result.passed, false);
  assert.equal(result.entered, false);
  assert.equal(result.obtainedMarks, null);
});
