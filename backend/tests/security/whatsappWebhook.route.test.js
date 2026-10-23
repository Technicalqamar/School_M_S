import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import express from 'express';
import { ApiError } from '../../src/utils/apiError.js';
import { computeSignature } from '../../src/services/whatsapp/whatsappWebhook.core.js';
import { receiveWhatsAppWebhook } from '../../src/controllers/whatsappWebhook.controller.js';
import whatsappWebhookRoutes from '../../src/routes/whatsappWebhook.routes.js';

// ---------------------------------------------------------------------------
// Route wiring, controller and raw-body integration tests.
//
// A small local Express app is started on an ephemeral port to prove that the
// webhook route receives a Buffer (the exact signed bytes) while ordinary
// routes still get the global JSON parser. The server only talks to localhost;
// the WhatsApp provider is never contacted.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_FILE = path.resolve(__dirname, '../../src/app.js');
const ROUTE_FILE = path.resolve(__dirname, '../../src/routes/whatsappWebhook.routes.js');
const CONTROLLER_FILE = path.resolve(__dirname, '../../src/controllers/whatsappWebhook.controller.js');
const SERVICE_FILE = path.resolve(__dirname, '../../src/services/whatsapp/whatsappWebhook.service.js');
const CORE_FILE = path.resolve(__dirname, '../../src/services/whatsapp/whatsappWebhook.core.js');

const SECRET = 'route-test-webhook-secret';
const WEBHOOK_PATH = '/api/v1/whatsapp/webhook';

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const createPayload = (id = 'route-msg-1') => ({
  event: 'message',
  data: {
    id,
    from: '923001234567',
    type: 'text',
    text: { body: 'Route level message' },
  },
});

const signedRequest = (payload, secret = SECRET) => {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': computeSignature(body, secret),
    },
  };
};

const createRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
};

const runController = async (req) => {
  const res = createRes();
  let nextError = null;
  let settle;
  const settled = new Promise((resolve) => {
    settle = resolve;
  });

  // `asyncHandler` does not return the handler's promise, so completion is
  // detected through the two terminal paths: the response or `next(error)`.
  res.json = (payload) => {
    res.body = payload;
    settle();
    return res;
  };

  receiveWhatsAppWebhook(req, res, (error) => {
    nextError = error;
    settle();
  });

  await settled;
  return { res, nextError };
};

describe('webhook route wiring', () => {
  it('is mounted at a dedicated path before the global JSON parser', () => {
    const appSource = fs.readFileSync(APP_FILE, 'utf8');

    assert.match(
      appSource,
      /import whatsappWebhookRoutes from '\.\/routes\/whatsappWebhook\.routes\.js';/,
    );

    const mountIndex = appSource.indexOf(`app.use('${WEBHOOK_PATH}', whatsappWebhookRoutes);`);
    const jsonParserIndex = appSource.indexOf('app.use(express.json());');

    assert.ok(mountIndex > -1, 'webhook route is not mounted');
    assert.ok(jsonParserIndex > -1, 'express.json() is missing');
    assert.ok(
      mountIndex < jsonParserIndex,
      'webhook route must be mounted before express.json() so the raw body survives',
    );
  });

  it('uses a scoped raw parser and only a POST handler', () => {
    const source = fs.readFileSync(ROUTE_FILE, 'utf8');

    assert.match(source, /express\.raw\(\{\s*type:\s*\(\)\s*=>\s*true,\s*limit:\s*'256kb'\s*\}\)/);
    assert.match(source, /router\.post\(\s*'\/'/);
    assert.doesNotMatch(source, /router\.(get|put|patch|delete)\s*\(/);
  });

  it('is deliberately unauthenticated and does not reuse the Admin settings guard', () => {
    const source = stripComments(fs.readFileSync(ROUTE_FILE, 'utf8'));

    assert.doesNotMatch(source, /\bprotect\b/);
    assert.doesNotMatch(source, /\bauthorize\b/);
    assert.doesNotMatch(source, /requireModuleAccess/);
  });

  it('keeps identity and outbound dependencies out of the HTTP layer', () => {
    // Phase 3B moved processing behind the service boundary on purpose: the
    // route, controller and webhook core must still contain no student lookup
    // or outbound client. Only the service binding delegates to the assistant.
    for (const file of [ROUTE_FILE, CONTROLLER_FILE, CORE_FILE]) {
      const source = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /student\.model|models\/student/, `${file} references students`);
      assert.doesNotMatch(source, /whatsappClient\.service|checkSession|sendMessage/, `${file} imports the outbound client`);
      assert.doesNotMatch(source, /fetch\s*\(/, `${file} makes network calls`);
    }

    const serviceSource = stripComments(fs.readFileSync(SERVICE_FILE, 'utf8'));
    assert.match(serviceSource, /whatsappAssistantService/);
    assert.match(serviceSource, /createTaskQueue/);
    assert.match(serviceSource, /WHATSAPP_WEBHOOK_PROCESSING_ENABLED/);
    assert.doesNotMatch(serviceSource, /student\.model|models\/student/);
    assert.doesNotMatch(serviceSource, /fetch\s*\(/);
  });
});

describe('webhook controller', () => {
  let previousSecret;
  let previousProcessing;

  before(() => {
    previousSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    previousProcessing = process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
    process.env.WHATSAPP_WEBHOOK_SECRET = SECRET;
    // Replies/DB lookups stay disabled for the HTTP-level tests.
    delete process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
  });

  after(() => {
    if (previousSecret === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
    else process.env.WHATSAPP_WEBHOOK_SECRET = previousSecret;

    if (previousProcessing === undefined) delete process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
    else process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED = previousProcessing;
  });

  it('rejects a request whose body was already parsed (raw bytes unavailable)', async () => {
    const { res, nextError } = await runController({
      body: { event: 'message' },
      headers: { 'x-webhook-signature': '0'.repeat(64) },
    });

    assert.equal(res.statusCode, null);
    assert.ok(nextError instanceof ApiError);
    assert.equal(nextError.statusCode, 400);
    assert.match(nextError.message, /body could not be read/);
  });

  it('returns the fixed acknowledgement for a valid delivery', async () => {
    const { body, headers } = signedRequest(createPayload('controller-1'));
    const { res, nextError } = await runController({ body, headers });

    assert.equal(nextError, null);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, message: 'Webhook received.' });
  });

  it('propagates an invalid signature as a 401 ApiError', async () => {
    const { body, headers } = signedRequest(createPayload('controller-2'), 'wrong-secret');
    const { res, nextError } = await runController({ body, headers });

    assert.equal(res.statusCode, null);
    assert.ok(nextError instanceof ApiError);
    assert.equal(nextError.statusCode, 401);
    assert.match(nextError.message, /signature/i);
  });

  it('fails closed with 503 when no signing secret is configured', async () => {
    const previous = process.env.WHATSAPP_WEBHOOK_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_SECRET;

    try {
      // Even a correctly signed body is refused: there is no configured secret
      // against which it could legitimately have been signed.
      const { body, headers } = signedRequest(createPayload('controller-3'));
      const { res, nextError } = await runController({ body, headers });

      assert.equal(res.statusCode, null);
      assert.ok(nextError instanceof ApiError);
      assert.equal(nextError.statusCode, 503);
    } finally {
      process.env.WHATSAPP_WEBHOOK_SECRET = previous;
    }
  });
});

describe('webhook raw-body integration (local only)', () => {
  let server;
  let baseUrl;
  let previousSecret;
  let previousProcessing;

  before(async () => {
    previousSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    previousProcessing = process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
    process.env.WHATSAPP_WEBHOOK_SECRET = SECRET;
    delete process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;

    const app = express();
    // Mirrors app.js: the webhook router is mounted before the JSON parser.
    app.use(WEBHOOK_PATH, whatsappWebhookRoutes);
    app.use(express.json());
    app.post('/api/v1/echo', (req, res) =>
      res.status(200).json({
        isBuffer: Buffer.isBuffer(req.body),
        body: req.body,
      }),
    );

    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));

    if (previousSecret === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
    else process.env.WHATSAPP_WEBHOOK_SECRET = previousSecret;

    if (previousProcessing === undefined) delete process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
    else process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED = previousProcessing;
  });

  const post = (url, body, headers = {}) =>
    fetch(url, { method: 'POST', headers, body });

  it('accepts a correctly signed JSON delivery as a raw buffer', async () => {
    const body = JSON.stringify(createPayload('http-valid-1'));
    const response = await post(`${baseUrl}${WEBHOOK_PATH}`, body, {
      'content-type': 'application/json',
      'x-webhook-signature': computeSignature(Buffer.from(body), SECRET),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, message: 'Webhook received.' });
  });

  it('still parses JSON normally on unrelated routes', async () => {
    const response = await post(`${baseUrl}/api/v1/echo`, JSON.stringify({ hello: 'world' }), {
      'content-type': 'application/json',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { isBuffer: false, body: { hello: 'world' } });
  });

  it('verifies the exact bytes that were transmitted, not the parsed JSON', async () => {
    const pretty = JSON.stringify(createPayload('http-raw-1'), null, 2);
    // The signature was computed over the minified form, so pretty-printing the
    // same JSON value on the wire must not verify.
    const signatureOverMinified = computeSignature(
      Buffer.from(JSON.stringify(createPayload('http-raw-1'))),
      SECRET,
    );

    const response = await post(`${baseUrl}${WEBHOOK_PATH}`, pretty, {
      'content-type': 'application/json',
      'x-webhook-signature': signatureOverMinified,
    });

    assert.equal(response.status, 401);
  });

  it('rejects a missing signature over HTTP', async () => {
    const response = await post(`${baseUrl}${WEBHOOK_PATH}`, JSON.stringify(createPayload('http-nosig-1')), {
      'content-type': 'application/json',
    });

    assert.equal(response.status, 401);
  });

  it('rejects malformed JSON with 400 when the signature is valid', async () => {
    const body = '{ "event": "message", ';
    const response = await post(`${baseUrl}${WEBHOOK_PATH}`, body, {
      'content-type': 'application/json',
      'x-webhook-signature': computeSignature(Buffer.from(body), SECRET),
    });

    assert.equal(response.status, 400);
  });

  it('rejects non-POST methods with 404', async () => {
    const response = await fetch(`${baseUrl}${WEBHOOK_PATH}`);
    assert.equal(response.status, 404);
  });
});
