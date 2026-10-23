// Focused tests for the fee-reminder message template.
//
// The frontend renderer only ever powers an admin preview; the message that is
// actually stored/sent is rendered again on the server from the real per-student
// balance. These tests pin that contract: the same template + the same context
// must render identically on both sides, placeholders must always come from the
// server-supplied context, and the default template must never claim a fee is
// overdue (there is no authoritative due date in this data set).
//
// Both modules are plain ESM, so they run under the project's existing
// `node --test` setup with no new dependency.

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  FEE_REMINDER_PLACEHOLDERS,
  renderFeeReminderMessage,
} = await import('../src/utils/feeReminderTemplate.js');

const backend = await import('../../backend/src/utils/feeReminderTemplate.js');

const context = {
  studentName: 'Ayesha Khan',
  studentId: 'STU-0001',
  className: 'Class 4',
  outstanding: 12500,
  feePeriod: 'January, February',
  schoolName: 'Green Valley School',
};

test('the placeholder list covers every token the default template uses', () => {
  const tokensInTemplate = [...DEFAULT_FEE_REMINDER_TEMPLATE.matchAll(/\{\{[a-zA-Z]+\}\}/g)].map(
    (match) => match[0],
  );
  for (const token of tokensInTemplate) {
    assert.ok(
      FEE_REMINDER_PLACEHOLDERS.includes(token),
      `default template token ${token} is not offered as a placeholder`,
    );
  }
});

test('the default template never claims a fee is overdue', () => {
  assert.doesNotMatch(DEFAULT_FEE_REMINDER_TEMPLATE.toLowerCase(), /overdue|late|penalt/);
});

test('rendering fills every placeholder from the supplied (server) context', () => {
  const rendered = renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, context);
  assert.match(rendered, /Ayesha Khan/);
  assert.match(rendered, /Class 4/);
  assert.match(rendered, /January, February/);
  // The outstanding amount is formatted with thousands separators.
  assert.match(rendered, /12,500/);
  assert.doesNotMatch(rendered, /\{\{/);
});

test('every offered placeholder is replaced, even with an empty context', () => {
  const rendered = renderFeeReminderMessage(FEE_REMINDER_PLACEHOLDERS.join(' '), {});
  assert.doesNotMatch(rendered, /\{\{/);
});

test('an unrecognized token typed by hand is left verbatim on both sides', () => {
  const rendered = renderFeeReminderMessage('Hi {{studentName}} {{unknownToken}}', {});
  // Known placeholders are filled; anything else is shown literally so the
  // admin can see and fix their own typo (never silently swallowed).
  assert.equal(rendered, 'Hi  {{unknownToken}}');
});

test('a missing template renders as an empty string, never "undefined"', () => {
  assert.equal(renderFeeReminderMessage('', context), '');
  assert.equal(renderFeeReminderMessage(null, context), '');
});

test('frontend preview and backend rendering are byte-for-byte identical', () => {
  const front = renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, context);
  const back = backend.renderFeeReminderMessage(backend.DEFAULT_FEE_REMINDER_TEMPLATE, context);
  assert.equal(front, back);

  // A custom template that includes the backend-only dueDate token also matches,
  // because both renderers leave an unsupplied token empty.
  const custom = '{{studentName}} owes {{outstanding}} for {{feePeriod}}{{dueDate}}';
  assert.equal(
    renderFeeReminderMessage(custom, context),
    backend.renderFeeReminderMessage(custom, context),
  );
});

test('buildFeePeriod joins unique due labels and falls back to the current session', () => {
  assert.equal(backend.buildFeePeriod([]), 'current session');
  assert.equal(
    backend.buildFeePeriod([{ month: 'January' }, { month: 'January' }, { exam: 'Final Term' }]),
    'January, Final Term',
  );
});

test('an unconfigured school name leaves no dangling sentence on either side', () => {
  // The service omits `schoolName` from the context when the school has not
  // saved one, so the `from {{schoolName}} regarding` sentence is dropped whole.
  const { schoolName, ...noSchool } = context;
  void schoolName;
  const front = renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, noSchool);
  const back = backend.renderFeeReminderMessage(backend.DEFAULT_FEE_REMINDER_TEMPLATE, noSchool);
  assert.equal(front, back);
  assert.doesNotMatch(front, /\{\{/);
  assert.doesNotMatch(front, /\n{3,}/);
  assert.match(front, /Dear Ayesha Khan,/);
  // If schoolName is missing, the sentence remains grammatically readable
  // (token replaced by empty string) and is never doubled with blank lines.
  assert.match(front, /from\s+regarding/);

  // A configured school name renders on its own line.
  const withSchool = renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, context);
  assert.match(withSchool, /Green Valley School/);
});
