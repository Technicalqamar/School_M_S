import crypto from 'node:crypto';
import { ApiError } from '../../utils/apiError.js';
import { normalizePhoneNumber } from './whatsappSettings.core.js';

// ---------------------------------------------------------------------------
// Incoming WhatsApp webhook foundation (Phase 3A).
//
// This module is deliberately dependency-free (only the local ApiError helper,
// Node's crypto module and the shared phone normalizer) so every security rule
// can be unit tested without a database or a live provider request.
//
// Security rules enforced here:
//   * the provider's HMAC-SHA256 signature is verified against the EXACT raw
//     request bytes with `crypto.timingSafeEqual` - the parsed JSON is never
//     used for verification, because re-serialising changes the bytes;
//   * the signing secret is a dedicated value (`WHATSAPP_WEBHOOK_SECRET`). The
//     WhatsApp API token is NEVER used as the signing secret;
//   * when the signing secret is not configured the endpoint fails closed
//     (503) and rejects every delivery. Unsigned messages are never accepted;
//   * the response body is a fixed, token-free acknowledgement. No student
//     data, phone number, message text, event id or credential is ever
//     returned or logged.
//
// Scope rules enforced here:
//   * only the documented incoming-message event with a supported text shape
//     is accepted; everything else is acknowledged with a 2xx and ignored;
//   * this module itself performs no student lookup, menu reply or outbound
//     message. In Phase 3B the service binding hands an accepted text message
//     to the assistant AFTER the acknowledgement, through a bounded queue.
// ---------------------------------------------------------------------------

// Provider contract: `X-Webhook-Signature: sha256=<hex HMAC-SHA256>` over the
// exact raw request body. Bare hex is still accepted for compatibility with
// earlier deliveries, but no signature is accepted without a valid HMAC.
const SIGNATURE_HEADER = 'x-webhook-signature';
const SIGNATURE_PREFIX = 'sha256=';
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/i;

// The provider's incoming-message event. Only this event is interpreted; every
// other event is acknowledged and ignored.
const SUPPORTED_EVENT = 'message';

// Group and broadcast JIDs must never be treated as a guardian phone number.
const GROUP_IDENTIFIER_PATTERN = /@(?:g\.us|broadcast)$/i;

// Request size guard. `express.raw` enforces the same limit at the route, this
// check is defence in depth for direct service calls.
const MAX_BODY_BYTES = 256 * 1024;

// Deduplication window. The store is in-memory on purpose: Phase 3A must not
// change the database schema. It deduplicates retries within one process; a
// restart clears it.
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUPE_MAX_ENTRIES = 5000;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Read a header without relying on the casing used by the caller.
 * Returns the first value when the runtime supplied an array.
 */
const readHeader = (headers, name) => {
  if (!headers || typeof headers !== 'object') return undefined;

  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) {
      const value = headers[key];
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return undefined;
};

/**
 * Normalize the signature header into 64 lowercase hex characters.
 * The documented provider format is `sha256=<hex>`; bare `<hex>` is retained
 * for compatibility. Anything else is treated as malformed. A malformed header
 * can only reject a delivery - it can never make an unsigned message pass
 * verification.
 */
const normalizeSignature = (value) => {
  if (typeof value !== 'string') return '';
  let signature = value.trim();
  if (!signature) return '';

  if (signature.toLowerCase().startsWith(SIGNATURE_PREFIX)) {
    signature = signature.slice(SIGNATURE_PREFIX.length).trim();
  }

  return HEX_SHA256_PATTERN.test(signature) ? signature.toLowerCase() : '';
};

/**
 * HMAC-SHA256 over the exact raw request bytes.
 */
const computeSignature = (rawBody, secret) =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

/**
 * Constant-time verification of the provider signature.
 *
 * Returns false for a missing/malformed header, a non-Buffer body, an empty
 * secret and a non-matching signature. The hex comparison happens on the raw
 * 32-byte digests, never on strings, so a partial match cannot be inferred
 * from the response timing.
 */
const verifySignature = ({ rawBody, secret, signature }) => {
  if (typeof secret !== 'string' || !secret.trim()) return false;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return false;

  const provided = normalizeSignature(signature);
  if (!provided) return false;

  const expected = computeSignature(rawBody, secret);
  const providedBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

/**
 * Bounded, time-limited in-memory dedupe store.
 *
 * `checkAndAdd` returns `{ duplicate: true }` when the key is still inside the
 * window and remembers it otherwise. Expired entries and entries beyond the
 * size cap are evicted so an attacker cannot grow memory without bound.
 */
const createDedupeStore = ({
  ttlMs = DEDUPE_TTL_MS,
  maxEntries = DEDUPE_MAX_ENTRIES,
  now = () => Date.now(),
} = {}) => {
  // Insertion order is expiry order because every entry gets the same TTL and
  // an existing key is never re-inserted.
  const entries = new Map();

  const prune = (timestamp) => {
    for (const [key, expiresAt] of entries) {
      if (expiresAt > timestamp) break;
      entries.delete(key);
    }
  };

  const checkAndAdd = (key) => {
    const timestamp = now();
    prune(timestamp);

    if (entries.has(key)) return { duplicate: true };

    entries.set(key, timestamp + ttlMs);

    // Enforce the cap after inserting so the store never exceeds maxEntries.
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      entries.delete(oldestKey);
    }

    return { duplicate: false };
  };

  return {
    checkAndAdd,
    size: () => entries.size,
    clear: () => entries.clear(),
  };
};

// The provider may place the event/message identifier at the envelope level or
// inside the payload object. Only string/number identifiers are considered.
const PROVIDER_ID_FIELDS = ['id', 'eventId', 'event_id', 'messageId', 'message_id'];

const readProviderId = (payload) => {
  const containers = [
    payload,
    isPlainObject(payload?.data) ? payload.data : null,
    isPlainObject(payload?.message) ? payload.message : null,
  ];

  for (const container of containers) {
    if (!container) continue;

    for (const field of PROVIDER_ID_FIELDS) {
      const value = container[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }

  return '';
};

/**
 * Resolve the dedupe key for a delivery.
 *
 * When the provider supplies an event/message id it is used directly. When the
 * id is missing, a hash of the exact raw body is used instead: an identical
 * retry is still deduplicated, while a different delivery always gets a
 * different key. The "derived:" prefix keeps the two namespaces apart.
 */
const resolveEventKey = (payload, rawBody) => {
  const providerId = readProviderId(payload);
  if (providerId) return { key: `provider:${providerId}`, source: 'provider' };

  const derived = crypto.createHash('sha256').update(rawBody).digest('hex');
  return { key: `derived:${derived}`, source: 'derived' };
};

const isGroupIdentifier = (value) =>
  typeof value === 'string' && GROUP_IDENTIFIER_PATTERN.test(value.trim());

/**
 * Read a message field from the documented top-level shape, falling back to the
 * older `data` object so existing callers remain compatible.
 */
const getMessageField = (payload, field) => {
  if (isPlainObject(payload) && payload[field] !== undefined) return payload[field];
  return isPlainObject(payload?.data) ? payload.data[field] : undefined;
};

/**
 * Extract the supported text-message facts from a delivery.
 *
 * Provider contract (top-level fields):
 *   { "event": "message", "id": "...", "timestamp": 123,
 *     "from": "923001234567", "to": "923...", "type": "text",
 *     "text": "Hello" }
 *
 * `text` may also be an object with a `body` string for compatibility. Group
 * and broadcast messages are rejected before the sender is normalized. The
 * message body is validated and returned for menu processing; it is never
 * logged, echoed in an HTTP response or used as an identity signal.
 */
const extractIncomingTextMessage = (payload) => {
  if (!isPlainObject(payload)) return { ok: false, reason: 'unsupported_payload' };

  const from = getMessageField(payload, 'from');
  const to = getMessageField(payload, 'to');

  // A group JID can look like a long numeric phone number after normalization.
  // Reject it explicitly so a group can never be matched to a guardian.
  if (isGroupIdentifier(from) || isGroupIdentifier(to)) {
    return { ok: false, reason: 'group_message' };
  }

  const rawType = getMessageField(payload, 'type');
  const type = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  if (type !== 'text') return { ok: false, reason: 'unsupported_message_type' };

  const rawText = getMessageField(payload, 'text');
  let body = '';
  if (typeof rawText === 'string') body = rawText;
  else if (isPlainObject(rawText) && typeof rawText.body === 'string') body = rawText.body;

  if (!body.trim()) return { ok: false, reason: 'empty_message' };

  const sender = normalizePhoneNumber(from);
  if (!sender) return { ok: false, reason: 'invalid_sender' };

  return { ok: true, message: { sender, text: body, providerId: readProviderId(payload) } };
};

const ACK_RECEIVED = { success: true, message: 'Webhook received.' };
const ACK_IGNORED = { success: true, message: 'Webhook event ignored.' };
const ACK_DUPLICATE = { success: true, message: 'Duplicate delivery ignored.' };

/**
 * Bounded in-process task queue.
 *
 * The webhook is acknowledged before any business logic runs, and the actual
 * reply work is serialized here. The pending backlog is capped, so a burst of
 * deliveries can never create unbounded async work or unbounded memory use.
 * `push` always resolves (never rejects) with `{ ok }`, and errors are handed
 * to `onError` so the caller can log a fixed, PII-free message.
 */
const createTaskQueue = ({ concurrency = 1, maxPending = 100, onError = null } = {}) => {
  const safeConcurrency = Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 1;
  const safeMaxPending = Number.isInteger(maxPending) && maxPending >= 0 ? maxPending : 100;

  const pending = [];
  let active = 0;

  const report = (error) => {
    if (typeof onError !== 'function') return;
    try {
      onError(error);
    } catch {
      // A logging hook must never break message processing.
    }
  };

  const drain = () => {
    while (active < safeConcurrency && pending.length > 0) {
      const job = pending.shift();
      active += 1;

      Promise.resolve()
        .then(job.task)
        .then(
          (value) => job.resolve({ ok: true, value }),
          (error) => {
            report(error);
            job.resolve({ ok: false });
          },
        )
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  const push = (task) => {
    if (typeof task !== 'function') return Promise.resolve({ ok: false, dropped: true });

    if (active >= safeConcurrency && pending.length >= safeMaxPending) {
      report(new Error('WhatsApp processing queue is full'));
      return Promise.resolve({ ok: false, dropped: true });
    }

    return new Promise((resolve) => {
      pending.push({ task, resolve });
      drain();
    });
  };

  return { push, size: () => active + pending.length };
};

/**
 * Build the webhook service.
 *
 * @param {object} [deps]
 * @param {() => string} [deps.getSecret] Lazily resolves the signing secret.
 * @param {ReturnType<typeof createDedupeStore>} [deps.dedupe] Dedupe store.
 * @param {{ error?: Function }} [deps.logger] Logger (never receives secrets).
 * @param {(message: { sender: string, text: string, providerId: string }) => Promise<unknown>} [deps.processMessage]
 *   Background message processor. It is invoked after the acknowledgement and
 *   is never awaited by the HTTP request.
 * @param {(task: () => Promise<unknown>) => Promise<unknown>} [deps.enqueue]
 *   Optional bounded scheduler for `processMessage`.
 */
const createWhatsAppWebhookService = ({
  getSecret = () => process.env.WHATSAPP_WEBHOOK_SECRET,
  dedupe = createDedupeStore(),
  logger = console,
  processMessage = null,
  enqueue = null,
} = {}) => {
  const handle = async ({ rawBody, headers } = {}) => {
    // Fail closed: without a configured signing secret nothing can be
    // verified, so every delivery is rejected. The API token is never used as
    // a fallback because it is a different credential.
    const secret = typeof getSecret === 'function' ? getSecret() : getSecret;
    if (typeof secret !== 'string' || !secret.trim()) {
      logger?.error?.(
        'WhatsApp webhook rejected: WHATSAPP_WEBHOOK_SECRET is not configured.',
      );
      throw new ApiError(503, 'WhatsApp webhook is not configured.');
    }

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      throw new ApiError(400, 'Webhook request body is required.');
    }

    if (rawBody.length > MAX_BODY_BYTES) {
      throw new ApiError(413, 'Webhook request body is too large.');
    }

    // The signature covers the raw bytes, so it is checked before anything is
    // parsed or logged.
    const signature = readHeader(headers, SIGNATURE_HEADER);
    if (!verifySignature({ rawBody, secret, signature })) {
      throw new ApiError(401, 'Invalid or missing webhook signature.');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new ApiError(400, 'Webhook payload is not valid JSON.');
    }

    if (!isPlainObject(payload)) {
      return { status: 202, body: ACK_IGNORED };
    }

    // Accept the documented event spelling without making the comparison
    // case-sensitive; all other events are acknowledged and ignored.
    const event = typeof payload.event === 'string' ? payload.event.trim().toLowerCase() : '';
    if (event !== SUPPORTED_EVENT) {
      return { status: 202, body: ACK_IGNORED };
    }

    const extracted = extractIncomingTextMessage(payload);
    if (!extracted.ok) {
      // A signed but unsupported/invalid message is acknowledged so the
      // provider does not retry it forever; it is never processed.
      return { status: 202, body: ACK_IGNORED };
    }

    const { key } = resolveEventKey(payload, rawBody);
    if (dedupe.checkAndAdd(key).duplicate) {
      return { status: 202, body: ACK_DUPLICATE };
    }

    // The acknowledgement is returned immediately; the assistant (guardian
    // match, menu, data lookup, provider reply) runs in the background. A
    // processing failure can therefore never turn a verified delivery into a
    // retry-provoking 5xx response.
    let processing = null;

    if (typeof processMessage === 'function') {
      const task = () =>
        processMessage({
          sender: extracted.message.sender,
          text: extracted.message.text,
          providerId: extracted.message.providerId,
        });

      try {
        if (typeof enqueue === 'function') {
          processing = enqueue(task);
        } else {
          processing = Promise.resolve()
            .then(task)
            .catch(() => {
              logger?.error?.('WhatsApp webhook message processing failed.');
            });
        }

        // If the caller ignores `processing`, a rejected task must still never
        // become an unhandled rejection.
        if (processing && typeof processing.catch === 'function') {
          processing.catch(() => {
            logger?.error?.('WhatsApp webhook message processing failed.');
          });
        }
      } catch {
        logger?.error?.('WhatsApp webhook message processing could not be started.');
        processing = null;
      }
    }

    return { status: 200, body: ACK_RECEIVED, processing };
  };

  return { handle };
};

export {
  SIGNATURE_HEADER,
  SUPPORTED_EVENT,
  GROUP_IDENTIFIER_PATTERN,
  MAX_BODY_BYTES,
  DEDUPE_TTL_MS,
  DEDUPE_MAX_ENTRIES,
  readHeader,
  normalizeSignature,
  computeSignature,
  verifySignature,
  createDedupeStore,
  readProviderId,
  resolveEventKey,
  isGroupIdentifier,
  extractIncomingTextMessage,
  createTaskQueue,
  createWhatsAppWebhookService,
};

export default createWhatsAppWebhookService;
