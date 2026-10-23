import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  CONNECTION_STATUS,
  SESSION_OUTCOME,
  WHATSAPP_TOKEN_KEY_SOURCES,
  maskToken,
  mapSessionResponse,
  normalizePhoneNumber,
  extractConnectedNumber,
  isSessionPayload,
  findSessionSignal,
  createWhatsAppSettingsService,
} from '../../../src/services/whatsapp/whatsappSettings.core.js';
import {
  encryptSecret,
  decryptSecret,
  DEFAULT_KEY_SOURCES,
  resolveSecretSource,
  resetFallbackWarnings,
} from '../../../src/utils/secretCrypto.js';

// ─────────────────────────────────────────────────────────────────────────────
// Every dependency of the WhatsApp settings service is mocked: the model
// layer, the encryption helpers and the provider client. No live provider
// request is ever made and no database is touched.
// ─────────────────────────────────────────────────────────────────────────────

const createFakeModel = (initial = {}) => {
  const doc = {
    key: 'whatsapp-settings',
    apiToken: null,
    tokenHint: '',
    connectionStatus: '',
    connectedNumber: '',
    lastCheckedAt: null,
    updatedAt: null,
    saveCount: 0,
    ...initial,
    async save() {
      doc.saveCount += 1;
      return doc;
    },
  };

  return {
    doc,
    model: {
      getSettings: async () => doc,
    },
  };
};

const createFakeCrypto = () => {
  const calls = { encrypt: [], decrypt: [] };

  const encrypt = (plainText, options = {}) => {
    calls.encrypt.push({ plainText, options });
    return {
      iv: 'test-iv',
      authTag: 'test-auth-tag',
      // Deliberately NOT the plaintext, so a test can prove that the stored
      // payload never contains the readable token.
      ciphertext: `encrypted(${Buffer.from(String(plainText)).toString('base64')})`,
    };
  };

  const decrypt = (payload, options = {}) => {
    calls.decrypt.push({ payload, options });
    if (!payload?.ciphertext) return null;
    return Buffer.from(
      String(payload.ciphertext).replace(/^encrypted\(/, '').replace(/\)$/, ''),
      'base64',
    ).toString('utf8');
  };

  return { encrypt, decrypt, calls };
};

const createService = (options = {}) => {
  const fakeModel = options.model || createFakeModel(options.doc);
  const fakeCrypto = options.crypto || createFakeCrypto();
  const client = options.client || { checkSession: async () => ({ ok: true }) };
  const auditCalls = [];
  const loggerCalls = [];

  const service = createWhatsAppSettingsService({
    model: fakeModel.model,
    encrypt: fakeCrypto.encrypt,
    decrypt: fakeCrypto.decrypt,
    client,
    audit: options.audit === null ? undefined : async (entry) => {
      auditCalls.push(entry);
    },
    logger: {
      error: (...args) => loggerCalls.push(args),
    },
  });

  return { service, fakeModel, fakeCrypto, client, auditCalls, loggerCalls };
};

describe('whatsappSettings service', () => {
  describe('token masking', () => {
    it('should keep only the last four characters', () => {
      assert.strictEqual(maskToken('abcdef123456'), '****3456');
    });

    it('should fully mask a short token', () => {
      assert.strictEqual(maskToken('abcd'), '****');
    });

    it('should return an empty hint for a missing token', () => {
      assert.strictEqual(maskToken(''), '');
      assert.strictEqual(maskToken(null), '');
      assert.strictEqual(maskToken(undefined), '');
    });
  });

  describe('provider response mapping', () => {
    it('should read an explicit connected boolean', () => {
      const result = mapSessionResponse({ connected: true, number: '+923001234567' });
      assert.strictEqual(result.outcome, SESSION_OUTCOME.CONNECTED);
      assert.strictEqual(result.connectedNumber, '+923001234567');
    });

    it('should read an explicit disconnected boolean', () => {
      const result = mapSessionResponse({ connected: false });
      assert.strictEqual(result.outcome, SESSION_OUTCOME.DISCONNECTED);
      assert.strictEqual(result.connectedNumber, '');
    });

    it('should read a connected status word', () => {
      assert.strictEqual(mapSessionResponse({ status: 'connected' }).outcome, SESSION_OUTCOME.CONNECTED);
      assert.strictEqual(mapSessionResponse({ state: 'OPEN' }).outcome, SESSION_OUTCOME.CONNECTED);
    });

    it('should read a disconnected status word', () => {
      assert.strictEqual(mapSessionResponse({ status: 'disconnected' }).outcome, SESSION_OUTCOME.DISCONNECTED);
      assert.strictEqual(mapSessionResponse({ status: 'logged_out' }).outcome, SESSION_OUTCOME.DISCONNECTED);
      assert.strictEqual(mapSessionResponse({ status: 'pending' }).outcome, SESSION_OUTCOME.DISCONNECTED);
    });

    it('should not report a successful response without a session state as connected', () => {
      // The provider answered, but never said whether a session exists.
      const result = mapSessionResponse({ ok: true });

      assert.strictEqual(result.outcome, SESSION_OUTCOME.UNKNOWN);
      assert.notStrictEqual(result.outcome, SESSION_OUTCOME.CONNECTED);
    });

    it('should report an empty payload as unknown', () => {
      assert.strictEqual(mapSessionResponse({}).outcome, SESSION_OUTCOME.UNKNOWN);
    });

    it('should report an unknown status word as unknown', () => {
      assert.strictEqual(mapSessionResponse({ status: 'starting' }).outcome, SESSION_OUTCOME.UNKNOWN);
      assert.strictEqual(mapSessionResponse({ status: 'whatever' }).outcome, SESSION_OUTCOME.UNKNOWN);
    });

    it('should report a malformed payload as unknown', () => {
      for (const payload of [null, undefined, 'connected', 42, true, ['connected']]) {
        assert.strictEqual(
          mapSessionResponse(payload).outcome,
          SESSION_OUTCOME.UNKNOWN,
          `payload ${JSON.stringify(payload)} must not be reported as connected`,
        );
      }
    });

    it('should not report a number-only payload as connected', () => {
      const result = mapSessionResponse({ number: '+923001234567' });

      assert.strictEqual(result.outcome, SESSION_OUTCOME.UNKNOWN);
      assert.strictEqual(result.connectedNumber, '+923001234567');
    });

    it('should recognise usable provider payloads', () => {
      assert.strictEqual(isSessionPayload({ status: 'connected' }), true);
      assert.strictEqual(isSessionPayload({}), true);
      assert.strictEqual(isSessionPayload([]), false);
      assert.strictEqual(isSessionPayload(null), false);
      assert.strictEqual(isSessionPayload('connected'), false);
    });

    it('should find an explicit session signal in a nested payload', () => {
      assert.strictEqual(
        mapSessionResponse({ data: { session: { connected: true } } }).outcome,
        SESSION_OUTCOME.CONNECTED,
      );
      assert.strictEqual(
        mapSessionResponse({ data: { session: { status: 'connected' } } }).outcome,
        SESSION_OUTCOME.CONNECTED,
      );
      assert.strictEqual(
        mapSessionResponse({ data: { session: { connected: false } } }).outcome,
        SESSION_OUTCOME.DISCONNECTED,
      );
      // A nested payload without a session state is still unknown.
      assert.strictEqual(
        mapSessionResponse({ data: { session: { id: '923001234567@s.whatsapp.net' } } }).outcome,
        SESSION_OUTCOME.UNKNOWN,
      );
    });

    it('should prefer a top-level signal over a nested one', () => {
      assert.strictEqual(
        mapSessionResponse({ connected: false, data: { connected: true } }).outcome,
        SESSION_OUTCOME.DISCONNECTED,
      );
    });

    it('should expose the explicit signal it found', () => {
      assert.deepStrictEqual(findSessionSignal({ connected: true }), { type: 'flag', value: true });
      assert.deepStrictEqual(findSessionSignal({ status: 'CONNECTED' }), {
        type: 'word',
        value: 'connected',
      });
      assert.strictEqual(findSessionSignal({ ok: true }), null);
    });

    it('should normalize WhatsApp JIDs into a phone number', () => {
      assert.strictEqual(normalizePhoneNumber('923001234567@s.whatsapp.net'), '923001234567');
      assert.strictEqual(normalizePhoneNumber('923001234567:12@s.whatsapp.net'), '923001234567');
      assert.strictEqual(normalizePhoneNumber('+92 (300) 123-4567'), '+923001234567');
      assert.strictEqual(normalizePhoneNumber('not-a-number'), '');
      assert.strictEqual(normalizePhoneNumber({}), '');
    });

    it('should find the connected number in nested provider payloads', () => {
      assert.strictEqual(
        extractConnectedNumber({ data: { session: { phoneNumber: '+923001234567' } } }),
        '+923001234567',
      );
      assert.strictEqual(extractConnectedNumber({ me: { id: '923001234567@s.whatsapp.net' } }), '923001234567');
      assert.strictEqual(extractConnectedNumber({ nothing: 'here' }), '');
    });
  });

  describe('getStatus', () => {
    it('should report "not configured" when no token is stored', async () => {
      const { service } = createService();

      const status = await service.getStatus();

      assert.strictEqual(status.configured, false);
      assert.strictEqual(status.status, CONNECTION_STATUS.NOT_CONFIGURED);
      assert.strictEqual(status.connectedNumber, '');
      assert.strictEqual(status.tokenHint, '');
    });

    it('should report an unknown state for a stored token that was never checked', async () => {
      const { service } = createService({
        doc: {
          apiToken: { iv: 'a', authTag: 'b', ciphertext: 'c' },
          tokenHint: '****3456',
          connectionStatus: '',
        },
      });

      const status = await service.getStatus();

      // Nothing has been established about the session yet, so it must not be
      // reported as connected (or as disconnected).
      assert.strictEqual(status.status, CONNECTION_STATUS.UNKNOWN);
      assert.strictEqual(status.lastCheckedAt, null);
    });

    it('should report the stored state without exposing the token', async () => {
      const { service } = createService({
        doc: {
          apiToken: { iv: 'a', authTag: 'b', ciphertext: 'c' },
          tokenHint: '****3456',
          connectionStatus: CONNECTION_STATUS.CONNECTED,
          connectedNumber: '+923001234567',
          lastCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      const status = await service.getStatus();

      assert.strictEqual(status.configured, true);
      assert.strictEqual(status.status, CONNECTION_STATUS.CONNECTED);
      assert.strictEqual(status.connectedNumber, '+923001234567');
      assert.strictEqual(status.tokenHint, '****3456');
      assert.ok(!JSON.stringify(status).includes('"c"'));
    });
  });

  describe('saveToken', () => {
    it('should encrypt the token before storing it', async () => {
      const { service, fakeModel, fakeCrypto } = createService();
      const token = 'super-secret-token-value';

      const status = await service.saveToken({ apiToken: token });

      assert.strictEqual(status.configured, true);
      assert.ok(fakeModel.doc.apiToken.ciphertext);
      assert.notStrictEqual(fakeModel.doc.apiToken.ciphertext, token);
      assert.ok(!fakeModel.doc.apiToken.ciphertext.includes(token));
      // The plaintext is only handed to the encryption helper.
      assert.strictEqual(fakeCrypto.calls.encrypt[0].plainText, token);
      assert.deepStrictEqual(fakeCrypto.calls.encrypt[0].options.keySources, WHATSAPP_TOKEN_KEY_SOURCES);
    });

    it('should only return the masked hint, never the token', async () => {
      const { service } = createService();
      const token = 'super-secret-token-value';

      const status = await service.saveToken({ apiToken: token });

      assert.strictEqual(status.tokenHint, '****alue');
      assert.ok(!JSON.stringify(status).includes(token));
    });

    it('should trim the token before storing it', async () => {
      const { service, fakeCrypto } = createService();

      await service.saveToken({ apiToken: '  padded-token  ' });

      assert.strictEqual(fakeCrypto.calls.encrypt[0].plainText, 'padded-token');
    });

    it('should reject a missing token', async () => {
      const { service } = createService();

      await assert.rejects(
        async () => service.saveToken({ apiToken: '' }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        },
      );

      await assert.rejects(
        async () => service.saveToken({}),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        },
      );
    });

    it('should reject a too short token', async () => {
      const { service } = createService();

      await assert.rejects(
        async () => service.saveToken({ apiToken: 'short' }),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        },
      );
    });

    it('should clear a previous connection result', async () => {
      const { service, fakeModel } = createService({
        doc: {
          apiToken: { iv: 'a', authTag: 'b', ciphertext: 'c' },
          connectionStatus: CONNECTION_STATUS.CONNECTED,
          connectedNumber: '+923001234567',
          lastCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      const status = await service.saveToken({ apiToken: 'another-token-value' });

      assert.strictEqual(status.status, CONNECTION_STATUS.UNKNOWN);
      assert.strictEqual(status.connectedNumber, '');
      assert.strictEqual(status.lastCheckedAt, null);
      assert.strictEqual(fakeModel.doc.connectionStatus, '');
    });

    it('should fail safely when the token cannot be encrypted', async () => {
      const token = 'super-secret-token-value';
      const { service, fakeModel, loggerCalls } = createService({
        crypto: {
          encrypt: () => {
            throw new Error('No encryption secret configured (WHATSAPP_TOKEN_ENCRYPTION_SECRET or JWT_SECRET)');
          },
          decrypt: () => null,
          calls: { encrypt: [], decrypt: [] },
        },
      });

      await assert.rejects(
        async () => service.saveToken({ apiToken: token }),
        (err) => {
          assert.strictEqual(err.statusCode, 500);
          assert.ok(!err.message.includes(token));
          assert.ok(!/WHATSAPP_TOKEN_ENCRYPTION_SECRET|JWT_SECRET/.test(err.message));
          return true;
        },
      );

      // Nothing is stored and the failure is logged without the secret.
      assert.strictEqual(fakeModel.doc.apiToken, null);
      assert.strictEqual(fakeModel.doc.tokenHint, '');
      const logged = JSON.stringify(loggerCalls);
      assert.ok(!logged.includes(token));
    });

    it('should record an audit entry that never contains the token', async () => {
      const { service, auditCalls } = createService();
      const token = 'super-secret-token-value';

      await service.saveToken({ apiToken: token, performedBy: 'admin-id' });

      assert.strictEqual(auditCalls.length, 1);
      assert.strictEqual(auditCalls[0].entityType, 'WhatsAppSettings');
      assert.ok(!JSON.stringify(auditCalls[0]).includes(token));
    });
  });

  describe('testConnection', () => {
    it('should refuse to run when no token is configured', async () => {
      const { service, client } = createService();
      let called = false;
      client.checkSession = async () => {
        called = true;
        return {};
      };

      await assert.rejects(
        async () => service.testConnection(),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('not configured'));
          return true;
        },
      );
      assert.strictEqual(called, false);
    });

    it('should pass the decrypted token to the provider client', async () => {
      const token = 'super-secret-token-value';
      let receivedOptions = null;
      const { service } = createService({
        client: {
          checkSession: async (options) => {
            receivedOptions = options;
            return { ok: true, connected: true, number: '+923001234567' };
          },
        },
      });

      await service.saveToken({ apiToken: token });
      await service.testConnection();

      assert.strictEqual(receivedOptions.token, token);
    });

    it('should report a connected session and store the phone number', async () => {
      const { service, fakeModel } = createService({
        client: {
          checkSession: async () => ({ ok: true, connected: true, number: '+923001234567' }),
        },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });
      const status = await service.testConnection();

      assert.strictEqual(status.status, CONNECTION_STATUS.CONNECTED);
      assert.strictEqual(status.connectedNumber, '+923001234567');
      assert.ok(status.lastCheckedAt instanceof Date);
      assert.strictEqual(fakeModel.doc.connectionStatus, CONNECTION_STATUS.CONNECTED);
    });

    it('should report a disconnected session', async () => {
      const { service, fakeModel } = createService({
        client: {
          checkSession: async () => ({ ok: true, connected: false }),
        },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });
      const status = await service.testConnection();

      assert.strictEqual(status.status, CONNECTION_STATUS.DISCONNECTED);
      assert.strictEqual(status.connectedNumber, '');
      assert.strictEqual(fakeModel.doc.connectionStatus, CONNECTION_STATUS.DISCONNECTED);
    });

    it('should report an unknown session when the provider response is not recognised', async () => {
      const { service, fakeModel } = createService({
        client: {
          checkSession: async () => ({ ok: true }),
        },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });
      const status = await service.testConnection();

      // The request succeeded, but the provider never stated the session state.
      assert.strictEqual(status.status, CONNECTION_STATUS.UNKNOWN);
      assert.notStrictEqual(status.status, CONNECTION_STATUS.CONNECTED);
      assert.strictEqual(status.connectedNumber, '');
      assert.strictEqual(fakeModel.doc.connectionStatus, CONNECTION_STATUS.UNKNOWN);
      assert.ok(status.lastCheckedAt instanceof Date);
    });

    it('should report an unknown session for a malformed provider response', async () => {
      const { service, fakeModel } = createService({
        client: {
          checkSession: async () => 'not-an-object',
        },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });
      const status = await service.testConnection();

      assert.strictEqual(status.status, CONNECTION_STATUS.UNKNOWN);
      assert.strictEqual(fakeModel.doc.connectionStatus, CONNECTION_STATUS.UNKNOWN);
    });

    it('should not keep a connected number of an unrecognised response', async () => {
      const { service, fakeModel } = createService({
        client: {
          checkSession: async () => ({ number: '+923001234567' }),
        },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });
      const status = await service.testConnection();

      assert.strictEqual(status.status, CONNECTION_STATUS.UNKNOWN);
      assert.strictEqual(status.connectedNumber, '');
      assert.strictEqual(fakeModel.doc.connectedNumber, '');
    });

    it('should store "check failed" and throw a token-free error when the provider call fails', async () => {
      const token = 'super-secret-token-value';
      const { service, fakeModel } = createService({
        client: {
          checkSession: async () => {
            throw new Error(`provider rejected token ${token}`);
          },
        },
      });

      await service.saveToken({ apiToken: token });

      await assert.rejects(
        async () => service.testConnection(),
        (err) => {
          assert.strictEqual(err.statusCode, 502);
          assert.ok(!err.message.includes(token));
          return true;
        },
      );

      assert.strictEqual(fakeModel.doc.connectionStatus, CONNECTION_STATUS.CHECK_FAILED);
      assert.strictEqual(fakeModel.doc.connectedNumber, '');
      assert.ok(fakeModel.doc.lastCheckedAt instanceof Date);
    });

    it('should surface the failed check through getStatus', async () => {
      const { service } = createService({
        client: {
          checkSession: async () => {
            throw new Error('provider unreachable');
          },
        },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });
      await assert.rejects(async () => service.testConnection());

      const status = await service.getStatus();
      assert.strictEqual(status.status, CONNECTION_STATUS.CHECK_FAILED);
      assert.strictEqual(status.configured, true);
    });

    it('should fail safely when the stored token cannot be decrypted', async () => {
      const { service } = createService({
        crypto: {
          encrypt: (value) => ({ iv: 'a', authTag: 'b', ciphertext: 'c' }),
          decrypt: () => {
            throw new Error('bad key');
          },
          calls: { encrypt: [], decrypt: [] },
        },
        client: { checkSession: async () => ({ ok: true }) },
      });

      await service.saveToken({ apiToken: 'super-secret-token-value' });

      await assert.rejects(
        async () => service.testConnection(),
        (err) => {
          assert.strictEqual(err.statusCode, 500);
          assert.ok(!err.message.includes('super-secret-token-value'));
          return true;
        },
      );
    });
  });

  describe('getStoredToken', () => {
    it('should return null when no token is stored', async () => {
      const { service } = createService();

      assert.strictEqual(await service.getStoredToken(), null);
    });

    it('should hand the decrypted token to internal outbound callers', async () => {
      const { service } = createService();
      await service.saveToken({ apiToken: 'outbound-token-value' });

      assert.strictEqual(await service.getStoredToken(), 'outbound-token-value');
    });

    it('should return null and log a token-free error when decryption fails', async () => {
      const token = 'super-secret-token-value';
      const { service, loggerCalls } = createService({
        crypto: {
          encrypt: () => ({ iv: 'a', authTag: 'b', ciphertext: 'c' }),
          decrypt: () => {
            throw new Error(`cannot decrypt ${token}`);
          },
          calls: { encrypt: [], decrypt: [] },
        },
      });

      await service.saveToken({ apiToken: token });

      assert.strictEqual(await service.getStoredToken(), null);
      assert.ok(loggerCalls.length > 0);
      assert.ok(!JSON.stringify(loggerCalls).includes(token));
    });

    it('should never expose the token through getStatus', async () => {
      const { service } = createService();
      await service.saveToken({ apiToken: 'outbound-token-value' });

      const status = await service.getStatus();

      assert.ok(!JSON.stringify(status).includes('outbound-token-value'));
    });
  });
});

describe('secretCrypto (WhatsApp token key)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetFallbackWarnings();
  });

  it('should round-trip a secret with the dedicated WhatsApp key', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';
    process.env.JWT_SECRET = 'jwt-key';

    const encrypted = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });

    assert.ok(encrypted.ciphertext);
    assert.ok(!encrypted.ciphertext.includes('super-secret-token-value'));
    assert.strictEqual(
      decryptSecret(encrypted, { keySources: WHATSAPP_TOKEN_KEY_SOURCES }),
      'super-secret-token-value',
    );
  });

  it('should encrypt with AES-256-GCM and a fresh nonce for every call', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';

    const first = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });
    const second = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });

    // 12-byte nonce and a 16-byte GCM authentication tag.
    assert.strictEqual(Buffer.from(first.iv, 'hex').length, 12);
    assert.strictEqual(Buffer.from(first.authTag, 'hex').length, 16);
    assert.notStrictEqual(first.iv, second.iv);
    assert.notStrictEqual(first.ciphertext, second.ciphertext);
  });

  it('should reject a tampered ciphertext', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';

    const encrypted = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });
    const tampered = {
      ...encrypted,
      ciphertext: `${encrypted.ciphertext.slice(0, -2)}00`,
    };

    assert.throws(() => decryptSecret(tampered, { keySources: WHATSAPP_TOKEN_KEY_SOURCES }));
  });

  it('should reject a tampered authentication tag', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';

    const encrypted = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });
    const tampered = {
      ...encrypted,
      authTag: `${encrypted.authTag.slice(0, -2)}00`,
    };

    assert.throws(() => decryptSecret(tampered, { keySources: WHATSAPP_TOKEN_KEY_SOURCES }));
  });

  it('should reject a tampered nonce', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';

    const encrypted = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });
    const tampered = {
      ...encrypted,
      iv: `${encrypted.iv.slice(0, -2)}00`,
    };

    assert.throws(() => decryptSecret(tampered, { keySources: WHATSAPP_TOKEN_KEY_SOURCES }));
  });

  it('should reject a payload that was encrypted with a different key', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';
    const encrypted = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });

    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'a-completely-different-key';

    assert.throws(() => decryptSecret(encrypted, { keySources: WHATSAPP_TOKEN_KEY_SOURCES }));
  });

  it('should fall back to the JWT secret when no dedicated key is configured', () => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET;
    process.env.JWT_SECRET = 'jwt-key';

    const encrypted = encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    });

    assert.strictEqual(
      decryptSecret(encrypted, { keySources: WHATSAPP_TOKEN_KEY_SOURCES }),
      'super-secret-token-value',
    );
  });

  it('should report the fallback to the JWT secret without logging a secret value', () => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET;
    process.env.JWT_SECRET = 'jwt-key';

    const warnings = [];
    const logger = { warn: (message) => warnings.push(String(message)) };

    encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
      logger,
    });

    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes('WHATSAPP_TOKEN_ENCRYPTION_SECRET'));
    assert.ok(warnings[0].includes('JWT_SECRET'));
    assert.ok(!warnings[0].includes('jwt-key'));
    assert.ok(!warnings[0].includes('super-secret-token-value'));
  });

  it('should report the fallback only once per secret family', () => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET;
    process.env.JWT_SECRET = 'jwt-key';

    const warnings = [];
    const logger = { warn: (message) => warnings.push(String(message)) };

    encryptSecret('super-secret-token-value', { keySources: WHATSAPP_TOKEN_KEY_SOURCES, logger });
    encryptSecret('another-secret-value', { keySources: WHATSAPP_TOKEN_KEY_SOURCES, logger });

    assert.strictEqual(warnings.length, 1);
  });

  it('should not report a fallback when the dedicated key is configured', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';
    process.env.JWT_SECRET = 'jwt-key';

    const warnings = [];
    const logger = { warn: (message) => warnings.push(String(message)) };

    encryptSecret('super-secret-token-value', { keySources: WHATSAPP_TOKEN_KEY_SOURCES, logger });

    assert.strictEqual(warnings.length, 0);
  });

  it('should prefer the dedicated key over the JWT secret', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = 'dedicated-whatsapp-key';
    process.env.JWT_SECRET = 'jwt-key';

    assert.strictEqual(
      resolveSecretSource(WHATSAPP_TOKEN_KEY_SOURCES),
      'WHATSAPP_TOKEN_ENCRYPTION_SECRET',
    );

    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET;

    assert.strictEqual(resolveSecretSource(WHATSAPP_TOKEN_KEY_SOURCES), 'JWT_SECRET');
  });

  it('should throw when no secret is configured at all', () => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET;
    delete process.env.JWT_SECRET;

    assert.throws(
      () => encryptSecret('super-secret-token-value', {
        keySources: WHATSAPP_TOKEN_KEY_SOURCES,
      }),
      (error) => {
        // The message names the environment variables only - never a value.
        assert.ok(error.message.includes('WHATSAPP_TOKEN_ENCRYPTION_SECRET'));
        assert.ok(!error.message.includes('super-secret-token-value'));
        return true;
      },
    );
  });

  it('should treat a blank secret as not configured', () => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET = '   ';
    delete process.env.JWT_SECRET;

    assert.strictEqual(resolveSecretSource(WHATSAPP_TOKEN_KEY_SOURCES), null);
    assert.throws(() => encryptSecret('super-secret-token-value', {
      keySources: WHATSAPP_TOKEN_KEY_SOURCES,
    }));
  });

  it('should keep the default portal password key behaviour unchanged', () => {
    process.env.DEFAULT_PASSWORD_SECRET = 'default-password-key';
    process.env.JWT_SECRET = 'jwt-key';

    const encrypted = encryptSecret('default-password');
    assert.strictEqual(decryptSecret(encrypted), 'default-password');
  });

  it('should keep the default portal password key sources unchanged', () => {
    assert.deepStrictEqual(DEFAULT_KEY_SOURCES, ['DEFAULT_PASSWORD_SECRET', 'JWT_SECRET']);
    assert.deepStrictEqual(WHATSAPP_TOKEN_KEY_SOURCES, [
      'WHATSAPP_TOKEN_ENCRYPTION_SECRET',
      'JWT_SECRET',
    ]);
  });

  it('should still fall back to the JWT secret for the default portal passwords', () => {
    delete process.env.DEFAULT_PASSWORD_SECRET;
    process.env.JWT_SECRET = 'jwt-key';

    const encrypted = encryptSecret('default-password');
    assert.strictEqual(decryptSecret(encrypted), 'default-password');
  });
});
