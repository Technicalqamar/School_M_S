// Focused tests for the Camera / USB QR scanner visibility settings.
//
// These settings are stored on the singleton SchoolSettings document and are
// edited through the existing Attendance Settings (`PUT /school-settings/academic`)
// endpoint. The middleware and schema are imported directly (no DB connection),
// so the tests pin the exact contract the attendance pages rely on:
//   * both switches are independent booleans,
//   * each defaults to ON when it has never been configured,
//   * anything that is not a boolean is rejected before it can corrupt state.

import test from 'node:test';
import assert from 'node:assert/strict';

const { validateAcademicSettings } = await import('../src/validations/schoolSettings.validation.js');
const { ApiError } = await import('../src/utils/apiError.js');
const { default: SchoolSettings } = await import('../src/models/schoolSettings.model.js');

// Runs the validation middleware against `body`. Returns true when it calls
// next(); throws whatever the middleware throws otherwise.
const runValidation = (body) => {
  let nextCalled = false;
  validateAcademicSettings({ body }, {}, () => {
    nextCalled = true;
  });
  return nextCalled;
};

test('scanner settings accept booleans and are independent of each other', () => {
  assert.equal(runValidation({ cameraQrScannerEnabled: true }), true);
  assert.equal(runValidation({ cameraQrScannerEnabled: false }), true);
  assert.equal(runValidation({ usbQrScannerEnabled: true }), true);
  assert.equal(runValidation({ usbQrScannerEnabled: false }), true);
  // Both supplied together, in any combination.
  assert.equal(
    runValidation({ cameraQrScannerEnabled: true, usbQrScannerEnabled: false }),
    true,
  );
  assert.equal(
    runValidation({ cameraQrScannerEnabled: false, usbQrScannerEnabled: false }),
    true,
  );
});

test('omitting the scanner settings leaves them untouched', () => {
  assert.equal(runValidation({}), true);
  // Other academic fields can still be saved without the scanner switches.
  assert.equal(runValidation({ lateAllowed: true }), true);
});

test('non-boolean scanner values are rejected with a 400', () => {
  for (const bad of ['true', 'false', 1, 0, null, {}]) {
    assert.throws(
      () => runValidation({ cameraQrScannerEnabled: bad }),
      (error) => error instanceof ApiError && error.statusCode === 400,
      `camera value ${JSON.stringify(bad)} should be rejected`,
    );
  }

  for (const bad of ['on', 'off', 1, 0, null, []]) {
    assert.throws(
      () => runValidation({ usbQrScannerEnabled: bad }),
      (error) => error instanceof ApiError && error.statusCode === 400,
      `usb value ${JSON.stringify(bad)} should be rejected`,
    );
  }
});

test('the schema stores both switches as booleans that default to ON', () => {
  const camera = SchoolSettings.schema.path('cameraQrScannerEnabled');
  const usb = SchoolSettings.schema.path('usbQrScannerEnabled');

  assert.equal(camera.instance, 'Boolean');
  assert.equal(usb.instance, 'Boolean');
  // Never-configured installs keep both scanners visible.
  assert.equal(camera.defaultValue, true);
  assert.equal(usb.defaultValue, true);
});
