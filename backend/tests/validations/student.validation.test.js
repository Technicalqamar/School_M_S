import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateCreateStudent,
  validateUpdateStudent,
} from '../../src/validations/student.validation.js';
import {
  PAK_MOBILE_REGEX,
  normalizePakistaniMobile,
} from '../../src/utils/pakistaniPhone.js';

// Focused tests for the optional guardian WhatsApp number added to students.
// No database is touched: these exercise request validation and the shared
// phone helpers only.

const CANONICAL = '923001234567';

const createBody = (overrides = {}) => ({
  fullName: 'Ali Khan',
  fatherName: 'Khan Ahmed',
  gender: 'Male',
  dateOfBirth: '2015-01-01',
  fatherPhone: '03001234567',
  alternatePhone: '',
  city: 'Lahore',
  address: 'House 1, Model Town',
  admissionDate: '2024-01-01',
  class: 'Class 1',
  academicYear: '2025',
  status: 'Active',
  ...overrides,
});

const run = (validator, body) => {
  const req = { body: { ...body } };
  let nextCalled = false;
  let error = null;

  try {
    validator(req, {}, () => {
      nextCalled = true;
    });
  } catch (caught) {
    error = caught;
  }

  return { req, nextCalled, error };
};

describe('Pakistani mobile helpers', () => {
  it('accepts the existing student phone spellings', () => {
    const values = [
      '03001234567',
      '0300-1234567',
      '0300 1234567',
      '+923001234567',
      '+92 300 1234567',
      '+92-300-1234567',
      '0092-300-1234567',
      '923001234567',
      '3001234567',
    ];

    for (const value of values) {
      assert.equal(PAK_MOBILE_REGEX.test(value), true, `expected ${value} to be valid`);
      assert.equal(normalizePakistaniMobile(value), CANONICAL, `failed for ${value}`);
    }
  });

  it('rejects non-Pakistani and malformed numbers', () => {
    const values = [
      '',
      '   ',
      null,
      undefined,
      923001234567,
      '12345',
      '042-37654321',
      '92300123456',
      '9230012345678',
      '030012345678',
      'not-a-phone',
    ];

    for (const value of values) {
      assert.equal(normalizePakistaniMobile(value), '', `expected ${String(value)} to be rejected`);
    }
  });
});

describe('validateCreateStudent whatsappNumber', () => {
  it('keeps the field optional for existing clients', () => {
    const { req, nextCalled, error } = run(validateCreateStudent, createBody());

    assert.equal(error, null);
    assert.equal(nextCalled, true);
    assert.equal(Object.prototype.hasOwnProperty.call(req.body, 'whatsappNumber'), false);
  });

  it('normalizes every accepted spelling to the WhatsApp canonical form', () => {
    const values = [
      '03001234567',
      '0300-1234567',
      '+92 300 1234567',
      '0092-300-1234567',
      '923001234567',
      '3001234567',
      ' 03001234567 ',
    ];

    for (const value of values) {
      const { req, nextCalled, error } = run(
        validateCreateStudent,
        createBody({ whatsappNumber: value }),
      );

      assert.equal(error, null, `unexpected error for ${value}`);
      assert.equal(nextCalled, true);
      assert.equal(req.body.whatsappNumber, CANONICAL, `failed for ${value}`);
    }
  });

  it('accepts an explicitly empty value and clears the field', () => {
    for (const value of ['', '   ', null]) {
      const { req, nextCalled, error } = run(
        validateCreateStudent,
        createBody({ whatsappNumber: value }),
      );

      assert.equal(error, null);
      assert.equal(nextCalled, true);
      assert.equal(req.body.whatsappNumber, '');
    }
  });

  it('rejects an invalid WhatsApp number', () => {
    for (const value of ['12345', '042-37654321', '030012345678', 'not-a-phone']) {
      const { nextCalled, error } = run(
        validateCreateStudent,
        createBody({ whatsappNumber: value }),
      );

      assert.equal(nextCalled, false);
      assert.equal(error?.statusCode, 400);
      assert.match(error?.message || '', /WhatsApp/);
    }
  });

  it('rejects a non-string WhatsApp number without coercing it', () => {
    const { nextCalled, error } = run(
      validateCreateStudent,
      createBody({ whatsappNumber: 923001234567 }),
    );

    assert.equal(nextCalled, false);
    assert.equal(error?.statusCode, 400);
  });
});

describe('validateUpdateStudent whatsappNumber', () => {
  it('leaves the field untouched when it is not part of the update', () => {
    const { req, nextCalled, error } = run(validateUpdateStudent, {
      fullName: 'Ali Khan',
    });

    assert.equal(error, null);
    assert.equal(nextCalled, true);
    assert.equal(Object.prototype.hasOwnProperty.call(req.body, 'whatsappNumber'), false);
  });

  it('normalizes a supplied WhatsApp number', () => {
    const { req, nextCalled, error } = run(validateUpdateStudent, {
      whatsappNumber: '+92 300 1234567',
    });

    assert.equal(error, null);
    assert.equal(nextCalled, true);
    assert.equal(req.body.whatsappNumber, CANONICAL);
  });

  it('allows clearing an existing WhatsApp number', () => {
    const { req, nextCalled, error } = run(validateUpdateStudent, {
      whatsappNumber: '',
    });

    assert.equal(error, null);
    assert.equal(nextCalled, true);
    assert.equal(req.body.whatsappNumber, '');
  });

  it('rejects an invalid WhatsApp number', () => {
    const { nextCalled, error } = run(validateUpdateStudent, {
      whatsappNumber: '030012345678',
    });

    assert.equal(nextCalled, false);
    assert.equal(error?.statusCode, 400);
    assert.match(error?.message || '', /WhatsApp/);
  });
});
