import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateWhatsAppToken } from '../../src/validations/whatsappSettings.validation.js';

// ─────────────────────────────────────────────────────────────────────────────
// Request validation for the WhatsApp token endpoint. The error messages are
// fixed strings so a rejected token can never be echoed back to the caller.
// ─────────────────────────────────────────────────────────────────────────────

const runValidation = (body) => {
  const req = { body };
  let nextCalled = false;
  let thrown = null;

  try {
    validateWhatsAppToken(req, {}, () => {
      nextCalled = true;
    });
  } catch (error) {
    thrown = error;
  }

  return { req, nextCalled, thrown };
};

describe('validateWhatsAppToken', () => {
  it('should accept a valid token and normalize it', () => {
    const { req, nextCalled, thrown } = runValidation({ apiToken: '  super-secret-token  ' });

    assert.strictEqual(thrown, null);
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.body.apiToken, 'super-secret-token');
  });

  it('should reject a missing token', () => {
    const { nextCalled, thrown } = runValidation({});

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(thrown.statusCode, 400);
    assert.ok(!thrown.message.includes('super-secret'));
  });

  it('should reject a non-string token', () => {
    const { nextCalled, thrown } = runValidation({ apiToken: 12345678 });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(thrown.statusCode, 400);
  });

  it('should reject an empty token', () => {
    const { nextCalled, thrown } = runValidation({ apiToken: '   ' });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(thrown.statusCode, 400);
  });

  it('should reject a too short token', () => {
    const { nextCalled, thrown } = runValidation({ apiToken: 'short' });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(thrown.statusCode, 400);
  });

  it('should reject a too long token', () => {
    const { nextCalled, thrown } = runValidation({ apiToken: 'a'.repeat(513) });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(thrown.statusCode, 400);
  });

  it('should reject a token containing whitespace', () => {
    const { nextCalled, thrown } = runValidation({ apiToken: 'super secret token' });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(thrown.statusCode, 400);
  });

  it('should never echo the submitted token in the error message', () => {
    const { thrown } = runValidation({ apiToken: '   ' });

    assert.ok(!thrown.message.includes('super-secret-token'));
  });
});
