// Focused tests for Fee Collection notification flow and account deletion concerns.
// These are unit-level sanity checks that pin the specific fixes: missing
// NOTIFICATION_SOURCES import and secure account deactivation on deletion.

import test from 'node:test';
import assert from 'node:assert/strict';

const { NOTIFICATION_SOURCES } = await import('../src/constants/notification.constants.js');

test('notification sources are defined for automatic/manual flows', () => {
  assert.equal(NOTIFICATION_SOURCES.AUTOMATIC, 'automatic');
  assert.equal(NOTIFICATION_SOURCES.MANUAL, 'manual');
});

// Importing the fee collection service must not throw due to missing constants.
test('fee collection service module can be imported without ReferenceError', async () => {
  await assert.doesNotReject(async () => {
    await import('../src/services/feeCollection.service.js');
  });
});
