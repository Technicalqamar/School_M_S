// Focused tests for the fee-reminder / payment-notification vocabulary.
//
// The Fee Reminder and payment-confirmation features reuse the existing
// Notification Engine; they add no new model and no new delivery system. The
// only shared contract they introduce is a notification type, so this test pins
// that the type exists in the single source of truth (which the Notification
// model's enum and the portal `types` filter both derive from) and that the
// server-rendered message never claims a fee is overdue.

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_SOURCES,
  NOTIFICATION_RELATED_MODELS,
} = await import('../src/constants/notification.constants.js');

const { renderFeeReminderMessage, DEFAULT_FEE_REMINDER_TEMPLATE, buildFeePeriod } = await import(
  '../src/utils/feeReminderTemplate.js'
);

test('FEE_REMINDER is a first-class notification type with a label', () => {
  assert.equal(NOTIFICATION_TYPES.FEE_REMINDER, 'FEE_REMINDER');
  assert.ok(NOTIFICATION_TYPE_VALUES.includes('FEE_REMINDER'));
  assert.ok(NOTIFICATION_TYPE_LABELS.FEE_REMINDER);
});

test('the types used by the fee features point at valid related entities', () => {
  // Payment confirmations and reminders both attach to these models.
  assert.ok(NOTIFICATION_RELATED_MODELS.includes('FeeCollection'));
  assert.ok(NOTIFICATION_RELATED_MODELS.includes('Student'));
});

test('manual reminders are distinguishable from automatic confirmations', () => {
  assert.equal(NOTIFICATION_SOURCES.MANUAL, 'manual');
  assert.equal(NOTIFICATION_SOURCES.AUTOMATIC, 'automatic');
});

test('the default fee reminder never claims a fee is overdue', () => {
  assert.doesNotMatch(DEFAULT_FEE_REMINDER_TEMPLATE.toLowerCase(), /overdue|late|penalt/);
});

test('only data the server actually has is rendered into the message', () => {
  const rendered = renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, {
    studentName: 'Bilal Ahmed',
    className: 'Class 7',
    outstanding: 3000,
    feePeriod: 'March',
    schoolName: 'Green Valley School',
  });
  assert.match(rendered, /Bilal Ahmed/);
  assert.match(rendered, /3,000/);
  assert.doesNotMatch(rendered, /\{\{/);
  // The year/fee period is only ever what the ledger reported.
  assert.match(rendered, /March/);
});

test('buildFeePeriod is bounded so a long ledger cannot bloat the message', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ month: `M${i}` }));
  const period = buildFeePeriod(many);
  assert.equal(period.split(', ').length, 10);
});
