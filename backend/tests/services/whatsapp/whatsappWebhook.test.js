import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIGNATURE_HEADER,
  MAX_BODY_BYTES,
  readHeader,
  normalizeSignature,
  computeSignature,
  verifySignature,
  createDedupeStore,
  readProviderId,
  resolveEventKey,
  extractIncomingTextMessage,
  createTaskQueue,
  createWhatsAppWebhookService,
} from '../../../src/services/whatsapp/whatsappWebhook.core.js';
import { ApiError } from '../../../src/utils/apiError.js';

// ---------------------------------------------------------------------------
// Focused tests for the incoming WhatsApp webhook foundation.
//
// Everything is exercised with an injected secret, an injected dedupe store and
// a fake logger. No provider request is made and no database is touched.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_FILE = path.resolve(
  __dirname,
  '../../../src/services/whatsapp/whatsappWebhook.core.js',
);

const SECRET = 'test-webhook-signing-secret';
const API_TOKEN = 'api-token-that-must-never-sign-webhooks';

const toBuffer = (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value));

const sign = (body, secret = SECRET) => computeSignature(toBuffer(body), secret);

const headersFor = (signature) =>
  signature === undefined ? {} : { [SIGNATURE_HEADER]: signature };

const createPayload = ({ id = 'msg-1', from = '923001234567', text = 'Hello from a parent' } = {}) => ({
  event: 'message',
  data: {
    id,
    from,
    type: 'text',
    text: { body: text },
  },
});

const bodyOf = (payload) => Buffer.from(JSON.stringify(payload));

const createFakeLogger = () => {
  const messages = [];
  return {
    messages,
    error: (...args) => messages.push(args),
    warn: (...args) => messages.push(args),
    log: (...args) => messages.push(args),
  };
};

const createService = ({ secret = SECRET, dedupe, logger } = {}) =>
  createWhatsAppWebhookService({
    getSecret: () => secret,
    dedupe,
    logger,
  });

const expectApiError = async (promise, statusCode) => {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.statusCode, statusCode);
    return true;
  });
};

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('webhook signature verification', () => {
  it('accepts a valid bare hex HMAC-SHA256 signature', () => {
    const body = bodyOf(createPayload());
    assert.equal(verifySignature({ rawBody: body, secret: SECRET, signature: sign(body) }), true);
  });

  it('accepts a valid signature with a sha256= prefix (any casing)', () => {
    const body = bodyOf(createPayload());
    assert.equal(
      verifySignature({ rawBody: body, secret: SECRET, signature: `sha256=${sign(body)}` }),
      true,
    );
    assert.equal(
      verifySignature({ rawBody: body, secret: SECRET, signature: `SHA256=${sign(body).toUpperCase()}` }),
      true,
    );
  });

  it('tolerates surrounding whitespace in the header', () => {
    const body = bodyOf(createPayload());
    assert.equal(
      verifySignature({ rawBody: body, secret: SECRET, signature: `  ${sign(body)}  ` }),
      true,
    );
  });

  it('rejects a signature produced with a different secret', () => {
    const body = bodyOf(createPayload());
    assert.equal(
      verifySignature({ rawBody: body, secret: SECRET, signature: sign(body, 'another-secret') }),
      false,
    );
  });

  it('rejects a signature when the body was tampered with', () => {
    const body = bodyOf(createPayload());
    const signature = sign(body);
    const tampered = bodyOf(createPayload({ text: 'Tampered message' }));
    assert.equal(verifySignature({ rawBody: tampered, secret: SECRET, signature }), false);
  });

  it('rejects a missing, empty or non-string signature', () => {
    const body = bodyOf(createPayload());
    for (const signature of [undefined, null, '', '   ', 12345, {}, []]) {
      assert.equal(verifySignature({ rawBody: body, secret: SECRET, signature }), false);
    }
  });

  it('rejects malformed signature formats', () => {
    const body = bodyOf(createPayload());
    const valid = sign(body);
    const cases = [
      'not-a-signature',
      valid.slice(0, 63), // one hex char short
      `${valid}00`, // one byte too long
      valid.replace(/[0-9a-f]/, 'z'), // non-hex
      `sha256=`,
      `sha256=${valid.slice(0, 32)}`,
      Buffer.from(valid).toString('base64'), // base64 is not accepted
    ];

    for (const signature of cases) {
      assert.equal(normalizeSignature(signature), '', `expected malformed: ${signature}`);
      assert.equal(verifySignature({ rawBody: body, secret: SECRET, signature }), false);
    }
  });

  it('rejects verification without a usable secret or raw body', () => {
    const body = bodyOf(createPayload());
    const signature = sign(body);
    assert.equal(verifySignature({ rawBody: body, secret: '', signature }), false);
    assert.equal(verifySignature({ rawBody: body, secret: '   ', signature }), false);
    assert.equal(verifySignature({ rawBody: body, secret: undefined, signature }), false);
    assert.equal(verifySignature({ rawBody: body.toString('utf8'), secret: SECRET, signature }), false);
    assert.equal(verifySignature({ rawBody: Buffer.alloc(0), secret: SECRET, signature }), false);
  });

  it('verifies the exact raw bytes, not a re-serialised object', () => {
    const payload = createPayload();
    const pretty = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
    const minified = Buffer.from(JSON.stringify(payload), 'utf8');

    assert.notDeepEqual(pretty, minified);

    const prettySignature = sign(pretty);
    assert.equal(verifySignature({ rawBody: pretty, secret: SECRET, signature: prettySignature }), true);
    // The same JSON value serialised differently must not verify.
    assert.equal(
      verifySignature({ rawBody: minified, secret: SECRET, signature: prettySignature }),
      false,
    );
  });

  it('uses a timing-safe comparison of the digests', () => {
    const source = fs.readFileSync(CORE_FILE, 'utf8');
    assert.match(source, /crypto\.createHmac\('sha256', secret\)/);
    assert.match(source, /crypto\.timingSafeEqual\(providedBuffer, expectedBuffer\)/);
    // The digest comparison must not short-circuit on a plain string compare.
    assert.doesNotMatch(source, /provided\s*===\s*expected/);
  });

  it('reads the signature header case-insensitively and handles array values', () => {
    const body = bodyOf(createPayload());
    const signature = sign(body);

    assert.equal(readHeader({ 'X-Webhook-Signature': signature }, SIGNATURE_HEADER), signature);
    assert.equal(
      readHeader({ [SIGNATURE_HEADER.toUpperCase()]: [signature] }, SIGNATURE_HEADER),
      signature,
    );
    assert.equal(readHeader({}, SIGNATURE_HEADER), undefined);
    assert.equal(readHeader(null, SIGNATURE_HEADER), undefined);
  });
});

// ---------------------------------------------------------------------------
// Delivery handling
// ---------------------------------------------------------------------------

describe('webhook delivery handling', () => {
  it('fails closed when the signing secret is not configured', async () => {
    const logger = createFakeLogger();
    const service = createService({ secret: '', logger });
    const body = bodyOf(createPayload());

    await expectApiError(service.handle({ rawBody: body, headers: headersFor(sign(body)) }), 503);
    assert.equal(logger.messages.length, 1);
    assert.match(String(logger.messages[0][0]), /WHATSAPP_WEBHOOK_SECRET is not configured/);

    // No part of the secret or body leaks into the log.
    const logged = JSON.stringify(logger.messages);
    assert.ok(!logged.includes('923001234567'));
    assert.ok(!logged.includes('Hello from a parent'));
  });

  it('never accepts a delivery signed with the WhatsApp API token', async () => {
    const service = createService({ secret: '' });
    const body = bodyOf(createPayload());
    const apiTokenSignature = sign(body, API_TOKEN);

    // With no webhook secret the endpoint is closed regardless of the header.
    await expectApiError(service.handle({ rawBody: body, headers: headersFor(apiTokenSignature) }), 503);

    // With a webhook secret configured, an API-token signature is simply wrong.
    const configured = createService({ secret: SECRET });
    await expectApiError(
      configured.handle({ rawBody: body, headers: headersFor(apiTokenSignature) }),
      401,
    );
  });

  it('accepts a valid delivery with a 200 acknowledgement', async () => {
    const service = createService();
    const body = bodyOf(createPayload());

    const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true, message: 'Webhook received.' });
  });

  it('rejects a missing signature with 401', async () => {
    const service = createService();
    const body = bodyOf(createPayload());

    await expectApiError(service.handle({ rawBody: body, headers: {} }), 401);
  });

  it('rejects an invalid signature with 401', async () => {
    const service = createService();
    const body = bodyOf(createPayload());

    await expectApiError(
      service.handle({ rawBody: body, headers: headersFor(sign(body, 'wrong-secret')) }),
      401,
    );
  });

  it('rejects a malformed signature with 401 and does not parse the body', async () => {
    const service = createService();
    const body = Buffer.from('definitely not json');

    await expectApiError(
      service.handle({ rawBody: body, headers: headersFor('sha256=not-hex') }),
      401,
    );
  });

  it('rejects malformed JSON with 400 when the signature is valid', async () => {
    const service = createService();
    const body = Buffer.from('{ this is not valid json');
    const result = service.handle({ rawBody: body, headers: headersFor(sign(body)) });

    await expectApiError(result, 400);
  });

  it('rejects an empty body with 400', async () => {
    const service = createService();
    await expectApiError(service.handle({ rawBody: Buffer.alloc(0), headers: {} }), 400);
  });

  it('rejects a body over the size limit with 413', async () => {
    const service = createService();
    const body = Buffer.alloc(MAX_BODY_BYTES + 1, 0x61);

    await expectApiError(service.handle({ rawBody: body, headers: headersFor('0'.repeat(64)) }), 413);
  });

  it('acknowledges an unsupported event with 2xx and ignores it', async () => {
    const service = createService();
    const body = bodyOf({ event: 'session.status', data: { connected: true } });

    const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });

    assert.equal(result.status, 202);
    assert.equal(result.body.message, 'Webhook event ignored.');
  });

  it('acknowledges a delivery without an event field as ignored', async () => {
    const service = createService();
    const body = bodyOf({ data: { id: 'x', from: '923001234567', type: 'text', text: { body: 'hi' } } });

    const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });

    assert.equal(result.status, 202);
  });

  it('acknowledges unsupported message types and payloads as ignored', async () => {
    const service = createService();
    const cases = [
      { event: 'message', data: { id: 'img-1', from: '923001234567', type: 'image', image: { id: 'x' } } },
      { event: 'message', data: { id: 'loc-1', from: '923001234567', type: 'location' } },
      { event: 'message', data: { id: 'empty-text', from: '923001234567', type: 'text', text: { body: '   ' } } },
      { event: 'message', data: 'not-an-object' },
      { event: 'message' },
    ];

    for (const payload of cases) {
      const body = bodyOf(payload);
      const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });
      assert.equal(result.status, 202, `expected ignored for ${JSON.stringify(payload)}`);
      assert.equal(result.body.message, 'Webhook event ignored.');
    }
  });

  it('acknowledges a message with an invalid sender without processing it', async () => {
    const service = createService();
    const cases = [
      { id: 'no-sender-1', from: undefined },
      { id: 'bad-sender-1', from: 'not-a-phone' },
      { id: 'short-sender-1', from: '12345' },
      { id: 'empty-sender-1', from: '   ' },
      { id: 'junk-sender-1', from: 'abc@s.whatsapp.net' },
    ];

    for (const { id, from } of cases) {
      const body = bodyOf({ event: 'message', data: { id, from, type: 'text', text: { body: 'hi' } } });
      const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });
      assert.equal(result.status, 202, `expected ignored for sender ${String(from)}`);
      assert.equal(result.body.message, 'Webhook event ignored.');
    }
  });

  it('accepts a WhatsApp JID sender and normalizes it to a phone number', () => {
    const extracted = extractIncomingTextMessage({
      event: 'message',
      data: { id: 'jid-1', from: '923001234567:12@s.whatsapp.net', type: 'text', text: { body: 'hi' } },
    });

    assert.equal(extracted.ok, true);
    assert.equal(extracted.message.sender, '923001234567');
    // Phase 3B needs the body for menu handling, but it is never echoed or
    // logged by the webhook layer.
    assert.equal(extracted.message.text, 'hi');
    assert.equal(extracted.message.providerId, 'jid-1');
    assert.deepEqual(Object.keys(extracted.message).sort(), ['providerId', 'sender', 'text']);
  });

  it('deduplicates a repeated provider event id', async () => {
    const service = createService();
    const payload = createPayload({ id: 'dedupe-1' });
    const body = bodyOf(payload);
    const signature = sign(body);

    const first = await service.handle({ rawBody: body, headers: headersFor(signature) });
    const second = await service.handle({ rawBody: body, headers: headersFor(signature) });

    assert.equal(first.status, 200);
    assert.equal(second.status, 202);
    assert.equal(second.body.message, 'Duplicate delivery ignored.');
  });

  it('deduplicates by provider id even when the payload text changes', async () => {
    const service = createService();
    const first = bodyOf(createPayload({ id: 'dedupe-id-2', text: 'first' }));
    const second = bodyOf(createPayload({ id: 'dedupe-id-2', text: 'second' }));

    assert.equal((await service.handle({ rawBody: first, headers: headersFor(sign(first)) })).status, 200);
    assert.equal((await service.handle({ rawBody: second, headers: headersFor(sign(second)) })).status, 202);
  });

  it('handles a missing provider id safely by deduplicating identical retries only', async () => {
    const service = createService();
    const noId = { event: 'message', data: { from: '923001234567', type: 'text', text: { body: 'same text' } } };
    const first = bodyOf(noId);
    const retry = Buffer.from(first); // identical bytes, as a provider retry would be
    const different = bodyOf({
      event: 'message',
      data: { from: '923001234567', type: 'text', text: { body: 'different text' } },
    });

    assert.equal((await service.handle({ rawBody: first, headers: headersFor(sign(first)) })).status, 200);
    assert.equal((await service.handle({ rawBody: retry, headers: headersFor(sign(retry)) })).status, 202);
    assert.equal((await service.handle({ rawBody: different, headers: headersFor(sign(different)) })).status, 200);
  });

  it('never returns or logs student data, phone numbers, message text or the secret', async () => {
    const logger = createFakeLogger();
    const service = createService({ logger });
    const payload = createPayload({ id: 'leak-1', text: 'Very confidential message' });
    const body = bodyOf(payload);

    const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });
    const response = JSON.stringify(result);

    for (const forbidden of [
      SECRET,
      API_TOKEN,
      '923001234567',
      'Very confidential message',
      'leak-1',
      'parent',
      'student',
      'fatherPhone',
    ]) {
      assert.ok(!response.toLowerCase().includes(forbidden.toLowerCase()), `response leaked: ${forbidden}`);
    }

    const logged = JSON.stringify(logger.messages);
    for (const forbidden of [SECRET, API_TOKEN, '923001234567', 'Very confidential message', 'leak-1']) {
      assert.ok(!logged.includes(forbidden), `log leaked: ${forbidden}`);
    }
    assert.deepEqual(result.body, { success: true, message: 'Webhook received.' });
  });
});

// ---------------------------------------------------------------------------
// Dedupe store and helpers
// ---------------------------------------------------------------------------

describe('webhook dedupe store', () => {
  it('remembers keys inside the window and forgets them after it', () => {
    let now = 1_000;
    const store = createDedupeStore({ ttlMs: 100, maxEntries: 10, now: () => now });

    assert.equal(store.checkAndAdd('a').duplicate, false);
    assert.equal(store.checkAndAdd('a').duplicate, true);

    now += 101;
    assert.equal(store.checkAndAdd('a').duplicate, false);
  });

  it('evicts the oldest key when the size cap is reached', () => {
    const store = createDedupeStore({ ttlMs: 10_000, maxEntries: 2, now: () => 0 });

    store.checkAndAdd('a');
    store.checkAndAdd('b');
    store.checkAndAdd('c');

    assert.equal(store.size(), 2);
    assert.equal(store.checkAndAdd('a').duplicate, false); // 'a' was evicted
    assert.equal(store.checkAndAdd('c').duplicate, true);
  });

  it('can be cleared', () => {
    const store = createDedupeStore();
    store.checkAndAdd('a');
    store.clear();
    assert.equal(store.size(), 0);
    assert.equal(store.checkAndAdd('a').duplicate, false);
  });
});

describe('webhook payload helpers', () => {
  it('reads provider ids from the envelope or the data object', () => {
    assert.equal(readProviderId({ id: 'env-1' }), 'env-1');
    assert.equal(readProviderId({ eventId: 'evt-1' }), 'evt-1');
    assert.equal(readProviderId({ data: { id: 'data-1' } }), 'data-1');
    assert.equal(readProviderId({ data: { messageId: 'msg-1' } }), 'msg-1');
    assert.equal(readProviderId({ data: { message_id: 'msg-2' } }), 'msg-2');
    assert.equal(readProviderId({ data: { id: 12345 } }), '12345');
    assert.equal(readProviderId({ data: {} }), '');
    assert.equal(readProviderId({}), '');
  });

  it('falls back to a deterministic raw-body hash when the id is missing', () => {
    const body = Buffer.from('{"event":"message"}');
    const first = resolveEventKey({ event: 'message' }, body);
    const second = resolveEventKey({ event: 'message' }, Buffer.from(body));

    assert.equal(first.source, 'derived');
    assert.match(first.key, /^derived:[0-9a-f]{64}$/);
    assert.equal(first.key, second.key);
    assert.notEqual(first.key, resolveEventKey({ event: 'message' }, Buffer.from('different')).key);
  });

  it('does not treat an empty or whitespace provider id as present', () => {
    const body = Buffer.from('{"event":"message"}');
    assert.equal(resolveEventKey({ id: '   ' }, body).source, 'derived');
    assert.equal(resolveEventKey({ id: '' }, body).source, 'derived');
  });

  it('hashes a derived id with SHA-256', () => {
    const body = Buffer.from('{"event":"message"}');
    const expected = crypto.createHash('sha256').update(body).digest('hex');
    assert.equal(resolveEventKey({}, body).key, `derived:${expected}`);
  });
});

// ---------------------------------------------------------------------------
// Background processing (Phase 3B)
// ---------------------------------------------------------------------------

describe('webhook background processing', () => {
  const createProcessingService = ({ processMessage, enqueue, logger } = {}) =>
    createWhatsAppWebhookService({
      getSecret: () => SECRET,
      logger,
      processMessage,
      enqueue,
    });

  it('acknowledges the delivery without waiting for the processor', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const processed = [];
    const service = createProcessingService({
      processMessage: async (message) => {
        processed.push(message);
        await gate;
      },
    });

    const body = bodyOf(createPayload({ id: 'bg-1', text: '1' }));
    const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true, message: 'Webhook received.' });

    // The task has started but the HTTP acknowledgement did not wait for it.
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(processed.length, 1);
    assert.deepEqual(processed[0], {
      sender: '923001234567',
      text: '1',
      providerId: 'bg-1',
    });

    release();
    await result.processing;
  });

  it('never processes a duplicate delivery twice', async () => {
    const processed = [];
    const service = createProcessingService({
      processMessage: async (message) => processed.push(message),
    });

    const body = bodyOf(createPayload({ id: 'bg-dup-1' }));
    const first = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });
    await first.processing;

    const second = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(first.status, 200);
    assert.equal(second.status, 202);
    assert.equal(processed.length, 1);
  });

  it('keeps the 200 acknowledgement and logs a generic message when processing fails', async () => {
    const logger = createFakeLogger();
    const service = createProcessingService({
      logger,
      processMessage: async () => {
        throw new Error('db failed for 923001234567');
      },
    });

    const body = bodyOf(createPayload({ id: 'bg-fail-1' }));
    const result = await service.handle({ rawBody: body, headers: headersFor(sign(body)) });

    assert.equal(result.status, 200);
    await result.processing;

    const logged = JSON.stringify(logger.messages);
    assert.ok(!logged.includes('923001234567'));
    assert.ok(!logged.includes('db failed'));
  });

  it('does not schedule work for ignored or unsupported deliveries', async () => {
    const processed = [];
    const service = createProcessingService({
      processMessage: async (message) => processed.push(message),
    });

    const unsupported = bodyOf({ event: 'status', data: { id: 'status-1' } });
    const unsupportedResult = await service.handle({
      rawBody: unsupported,
      headers: headersFor(sign(unsupported)),
    });

    const nonText = bodyOf({
      event: 'message',
      data: { id: 'image-1', from: '923001234567', type: 'image' },
    });
    const nonTextResult = await service.handle({
      rawBody: nonText,
      headers: headersFor(sign(nonText)),
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(unsupportedResult.status, 202);
    assert.equal(nonTextResult.status, 202);
    assert.equal(processed.length, 0);
  });
});

describe('bounded task queue', () => {
  it('runs tasks in order with one worker', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const order = [];
    const queue = createTaskQueue({ concurrency: 1, maxPending: 10 });

    const first = queue.push(async () => {
      order.push('first:start');
      await gate;
      order.push('first:end');
    });
    const second = queue.push(async () => {
      order.push('second');
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ['first:start']);

    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['first:start', 'first:end', 'second']);
  });

  it('catches task errors and resolves with a failure result', async () => {
    const errors = [];
    const queue = createTaskQueue({
      concurrency: 1,
      onError: (error) => errors.push(error),
    });

    const result = await queue.push(async () => {
      throw new Error('boom');
    });

    assert.deepEqual(result, { ok: false });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'boom');
  });

  it('drops work when the bounded backlog is full', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const errors = [];
    const queue = createTaskQueue({
      concurrency: 1,
      maxPending: 1,
      onError: (error) => errors.push(error),
    });

    const active = queue.push(async () => {
      await gate;
      return 'active';
    });
    const pending = queue.push(async () => 'pending');
    const dropped = await queue.push(async () => 'dropped');

    assert.deepEqual(dropped, { ok: false, dropped: true });
    assert.equal(errors.length, 1);

    release();
    assert.deepEqual(await Promise.all([active, pending]), [
      { ok: true, value: 'active' },
      { ok: true, value: 'pending' },
    ]);
  });
});
