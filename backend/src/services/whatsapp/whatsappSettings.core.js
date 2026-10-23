import { ApiError } from '../../utils/apiError.js';
import { WHATSAPP_TOKEN_KEY_SOURCES } from '../../utils/secretCrypto.js';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp settings service (core).
//
// This module holds every piece of WhatsApp-settings logic and imports only
// the local ApiError helper and the (dependency-free) crypto helper, so all of
// it can be unit tested with a mocked model/crypto/provider layer and without
// any live provider traffic. `whatsappSettings.service.js` binds the real
// dependencies (Mongoose model, AES-256-GCM helpers, WhatsApp API client) to it.
//
// Security rules enforced here:
//   * the provider token is encrypted before it is persisted and is never
//     returned to the caller, never logged and never embedded in an error
//     message - only a masked hint ("****abcd") leaves the backend;
//   * the decrypted token is only ever handed to the provider client.
//
// Correctness rules enforced here:
//   * a successful HTTP response is NOT proof of a live session. Only an
//     explicit connected signal from the provider may be reported as
//     "connected"; an unrecognised or malformed payload is reported as
//     "unknown" so a broken provider response can never look like a healthy
//     integration.
// ─────────────────────────────────────────────────────────────────────────────

// The connection states surfaced by the Admin Settings UI.
const CONNECTION_STATUS = {
  NOT_CONFIGURED: 'not_configured',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  UNKNOWN: 'unknown',
  CHECK_FAILED: 'check_failed',
};

// The outcome of interpreting a provider session payload.
const SESSION_OUTCOME = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  UNKNOWN: 'unknown',
};

// Maps a session outcome onto the persisted connection status.
const CONNECTION_STATUS_BY_OUTCOME = {
  [SESSION_OUTCOME.CONNECTED]: CONNECTION_STATUS.CONNECTED,
  [SESSION_OUTCOME.DISCONNECTED]: CONNECTION_STATUS.DISCONNECTED,
  [SESSION_OUTCOME.UNKNOWN]: CONNECTION_STATUS.UNKNOWN,
};

const TOKEN_MASK = '****';
const MIN_TOKEN_LENGTH = 8;
const MAX_TOKEN_LENGTH = 512;

/**
 * Build the masked hint that may safely be shown in the UI. Only the last four
 * characters are kept, everything before them is replaced by a fixed mask.
 */
const maskToken = (token) => {
  if (typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 4) return TOKEN_MASK;
  return `${TOKEN_MASK}${trimmed.slice(-4)}`;
};

// ── Provider response mapping ───────────────────────────────────────────────
//
// The exact shape of `GET /session` is not documented by the provider, so the
// mapping looks for the usual field names. It is deliberately STRICT: a
// payload that does not explicitly state whether a session exists is reported
// as "unknown", never as "connected". The request succeeding only proves that
// the provider answered - it does not prove that WhatsApp is logged in.

const CONNECTED_BOOLEAN_FIELDS = [
  'connected',
  'isConnected',
  'is_connected',
  'active',
  'isActive',
  'is_active',
  'authenticated',
  'isAuthenticated',
  'is_authenticated',
  'linked',
  'isLinked',
  'is_linked',
  'ready',
  'isReady',
  'loggedIn',
  'logged_in',
];

const STATUS_FIELDS = [
  'status',
  'state',
  'sessionStatus',
  'session_status',
  'connectionStatus',
  'connection_status',
];

const CONNECTED_STATUS_WORDS = [
  'connected',
  'open',
  'active',
  'ready',
  'online',
  'linked',
  'authenticated',
  'logged_in',
  'loggedin',
  'ok',
  'success',
  'running',
];

const DISCONNECTED_STATUS_WORDS = [
  'disconnected',
  'closed',
  'offline',
  'logged_out',
  'loggedout',
  'not_connected',
  'notconnected',
  'unlinked',
  'expired',
  'unauthorized',
  'invalid',
  'pending',
  'scanned',
  'qr',
  'disconnecting',
  'stopped',
];

const NUMBER_FIELDS = [
  'connectedNumber',
  'connected_number',
  'phoneNumber',
  'phone_number',
  'sessionNumber',
  'session_number',
  'senderNumber',
  'sender_number',
  'meNumber',
  'me_number',
  'meId',
  'me_id',
  'number',
  'phone',
  'me',
  'jid',
  'wid',
  'sender',
  'user',
  'username',
  'from',
];

// A nested provider object (e.g. `me: { id: "9230...@s.whatsapp.net" }`) often
// carries the identifier under a generic key, so those keys are inspected too.
const NESTED_ID_FIELDS = ['id', 'jid', 'wid', 'number', 'phone', 'phoneNumber', 'phone_number'];

const PHONE_PATTERN = /^\+?\d{7,15}$/;

/**
 * Normalize a provider-supplied identifier into a plain phone number.
 * WhatsApp JIDs ("923001234567@s.whatsapp.net", "923001234567:12@s.whatsapp.net")
 * are reduced to their numeric part; anything that is not a plausible phone
 * number is rejected so a random identifier is never shown as a number.
 */
const normalizePhoneNumber = (value) => {
  let text = null;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
  if (!text) return '';

  text = text.trim();
  if (!text) return '';

  const atIndex = text.indexOf('@');
  if (atIndex > 0) text = text.slice(0, atIndex);
  const colonIndex = text.indexOf(':');
  if (colonIndex > 0) text = text.slice(0, colonIndex);

  text = text.replace(/[\s\-()]/g, '');
  if (!PHONE_PATTERN.test(text)) return '';
  return text;
};

/**
 * Find the connected phone number in the provider response. The number may sit
 * at the top level or one or two levels deep, so the lookup walks the object
 * for a bounded depth.
 */
const extractConnectedNumber = (data, depth = 0) => {
  if (!data || typeof data !== 'object' || depth > 2) return '';

  for (const field of NUMBER_FIELDS) {
    const phone = normalizePhoneNumber(data[field]);
    if (phone) return phone;
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const idField of NESTED_ID_FIELDS) {
        const phone = normalizePhoneNumber(value[idField]);
        if (phone) return phone;
      }

      const nested = extractConnectedNumber(value, depth + 1);
      if (nested) return nested;
    }
  }

  return '';
};

const readBooleanFlag = (data) => {
  for (const field of CONNECTED_BOOLEAN_FIELDS) {
    if (typeof data?.[field] === 'boolean') return data[field];
  }
  return null;
};

const readStatusWord = (data) => {
  for (const field of STATUS_FIELDS) {
    const value = data?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  }
  return null;
};

/**
 * A provider payload is only usable when it is a plain JSON object. Anything
 * else (null, an array, a string, a number) is malformed and carries no
 * session state at all.
 */
const isSessionPayload = (data) =>
  Boolean(data) && typeof data === 'object' && !Array.isArray(data);

/**
 * Look for an EXPLICIT session signal in the payload.
 *
 * The signal may sit at the top level or inside a nested object (providers
 * commonly wrap the session in `data`/`session`), so the lookup walks the
 * payload for a bounded depth. A boolean flag wins over a status word, and a
 * top-level signal wins over a nested one.
 *
 * Returns `{ type: 'flag' | 'word', value }` or null when the payload states
 * nothing about the session.
 */
const findSessionSignal = (data, depth = 0) => {
  if (!isSessionPayload(data) || depth > 2) return null;

  const flag = readBooleanFlag(data);
  if (flag !== null) return { type: 'flag', value: flag };

  const word = readStatusWord(data);
  if (word) return { type: 'word', value: word };

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = findSessionSignal(value, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
};

/**
 * Translate a successful provider session response into the facts the UI
 * needs: whether the session is connected, which phone number it belongs to
 * and - most importantly - whether the provider stated the session state at
 * all.
 *
 * Returns `{ outcome, connectedNumber }` where `outcome` is one of
 * `connected`, `disconnected` or `unknown`. `unknown` means the provider
 * answered without stating whether a session exists; it must never be
 * reported as a connected session.
 */
const mapSessionResponse = (data) => {
  if (!isSessionPayload(data)) {
    return { outcome: SESSION_OUTCOME.UNKNOWN, connectedNumber: '' };
  }

  const payload = data;
  const connectedNumber = extractConnectedNumber(payload);

  const signal = findSessionSignal(payload);

  if (signal?.type === 'flag') {
    return {
      outcome: signal.value ? SESSION_OUTCOME.CONNECTED : SESSION_OUTCOME.DISCONNECTED,
      connectedNumber,
    };
  }

  if (signal?.type === 'word') {
    if (DISCONNECTED_STATUS_WORDS.includes(signal.value)) {
      return { outcome: SESSION_OUTCOME.DISCONNECTED, connectedNumber };
    }
    if (CONNECTED_STATUS_WORDS.includes(signal.value)) {
      return { outcome: SESSION_OUTCOME.CONNECTED, connectedNumber };
    }
  }

  // The provider did not state whether a session exists (unknown field names,
  // an unknown status word, or no status at all). The state stays unknown.
  return { outcome: SESSION_OUTCOME.UNKNOWN, connectedNumber };
};

/**
 * Build the WhatsApp settings service.
 *
 * @param {object} deps
 * @param {{ getSettings: () => Promise<object> }} deps.model Mongoose-like model.
 * @param {(value: string, options?: object) => object} deps.encrypt Encryption helper.
 * @param {(payload: object, options?: object) => string|null} deps.decrypt Decryption helper.
 * @param {{ checkSession: (options?: object) => Promise<object> }} deps.client WhatsApp API client.
 * @param {(entry: object) => Promise<void>} [deps.audit] Optional audit trail writer.
 * @param {{ error?: Function }} [deps.logger] Optional logger.
 */
const createWhatsAppSettingsService = ({
  model,
  encrypt,
  decrypt,
  client,
  audit = null,
  logger = console,
} = {}) => {
  if (!model || !encrypt || !decrypt || !client) {
    throw new Error('WhatsApp settings service requires model, encrypt, decrypt and client dependencies');
  }

  const readDocument = () => model.getSettings();

  /**
   * Public, token-free representation of the current settings.
   * `configured` says whether a token is stored; `status` is one of the
   * states the Admin Settings UI renders.
   *
   * A stored token that was never checked is reported as `unknown`, not as
   * `disconnected`: nothing has been established about the session yet.
   */
  const buildStatus = (doc) => {
    const configured = Boolean(doc?.apiToken?.ciphertext);
    const status = configured
      ? (doc?.connectionStatus || CONNECTION_STATUS.UNKNOWN)
      : CONNECTION_STATUS.NOT_CONFIGURED;

    return {
      configured,
      status,
      connectedNumber: configured ? (doc?.connectedNumber || '') : '',
      tokenHint: configured ? (doc?.tokenHint || '') : '',
      lastCheckedAt: doc?.lastCheckedAt || null,
      updatedAt: doc?.updatedAt || null,
    };
  };

  const getStatus = async () => buildStatus(await readDocument());

  /**
   * Store (or replace) the provider token. The token is validated, encrypted
   * and persisted; only the masked hint is ever returned. Any previous
   * connection result described the previous token, so it is cleared.
   */
  const saveToken = async ({ apiToken, performedBy = null } = {}) => {
    if (typeof apiToken !== 'string' || !apiToken.trim()) {
      throw new ApiError(400, 'WhatsApp API token is required');
    }

    const token = apiToken.trim();
    if (token.length < MIN_TOKEN_LENGTH) {
      throw new ApiError(400, `WhatsApp API token must be at least ${MIN_TOKEN_LENGTH} characters`);
    }
    if (token.length > MAX_TOKEN_LENGTH) {
      throw new ApiError(400, `WhatsApp API token must be at most ${MAX_TOKEN_LENGTH} characters`);
    }

    const doc = await readDocument();

    // The token is encrypted before it is stored. A missing or invalid
    // encryption key must fail closed with a token-free message instead of
    // leaking the configuration detail (or the token) to the caller.
    let encryptedToken;
    try {
      encryptedToken = encrypt(token, { keySources: WHATSAPP_TOKEN_KEY_SOURCES });
    } catch (error) {
      logger?.error?.('Failed to encrypt the WhatsApp API token:', error?.message);
      throw new ApiError(
        500,
        'Unable to encrypt the WhatsApp API token because the server encryption key is not configured.',
      );
    }

    doc.apiToken = encryptedToken;
    doc.tokenHint = maskToken(token);
    doc.connectionStatus = '';
    doc.connectedNumber = '';
    doc.lastCheckedAt = null;
    doc.updatedBy = performedBy || null;

    await doc.save();

    if (audit) {
      // Never include the token itself (not even masked) in the audit trail.
      await audit({
        action: 'UPDATE',
        module: 'USER',
        entityId: doc.key,
        entityType: 'WhatsAppSettings',
        performedBy,
        details: { tokenUpdated: true },
      });
    }

    return buildStatus(doc);
  };

  /**
   * Run a live connection check against the provider with the stored token and
   * record the outcome. The provider error is never forwarded verbatim, so a
   * token can never leak through an API error message.
   */
  const testConnection = async () => {
    const doc = await readDocument();

    if (!doc?.apiToken?.ciphertext) {
      throw new ApiError(400, 'WhatsApp API token is not configured. Save a token before testing the connection.');
    }

    let token;
    try {
      token = decrypt(doc.apiToken, { keySources: WHATSAPP_TOKEN_KEY_SOURCES });
    } catch (error) {
      logger?.error?.('Failed to decrypt the WhatsApp API token:', error?.message);
      throw new ApiError(500, 'Unable to read the stored WhatsApp API token. Please save the token again.');
    }

    if (!token) {
      throw new ApiError(500, 'Unable to read the stored WhatsApp API token. Please save the token again.');
    }

    try {
      const result = await client.checkSession({ token });
      const { outcome, connectedNumber } = mapSessionResponse(result);

      // Only an explicit connected signal is persisted as "connected". An
      // unrecognised payload is persisted as "unknown" so the UI can say that
      // the state could not be determined.
      doc.connectionStatus =
        CONNECTION_STATUS_BY_OUTCOME[outcome] || CONNECTION_STATUS.UNKNOWN;
      doc.connectedNumber = outcome === SESSION_OUTCOME.CONNECTED ? connectedNumber : '';
      doc.lastCheckedAt = new Date();
      await doc.save();

      return buildStatus(doc);
    } catch (error) {
      // The check itself failed: remember that state so the UI can show it,
      // but answer with a fixed, token-free message.
      doc.connectionStatus = CONNECTION_STATUS.CHECK_FAILED;
      doc.connectedNumber = '';
      doc.lastCheckedAt = new Date();
      try {
        await doc.save();
      } catch (saveError) {
        logger?.error?.('Failed to persist the WhatsApp connection check result:', saveError?.message);
      }

      logger?.error?.('WhatsApp connection check failed:', error?.message);
      throw new ApiError(502, 'Unable to verify the WhatsApp connection. Please check the API token and try again.');
    }
  };

  /**
   * Return the decrypted provider token for outbound replies, or null when no
   * token is stored or it cannot be decrypted.
   *
   * Internal use only: this is never wired to an HTTP route, and the returned
   * value must never be logged or embedded in an error message.
   */
  const getStoredToken = async () => {
    const doc = await readDocument();
    if (!doc?.apiToken?.ciphertext) return null;

    try {
      const token = decrypt(doc.apiToken, { keySources: WHATSAPP_TOKEN_KEY_SOURCES });
      return typeof token === 'string' && token ? token : null;
    } catch {
      // Never include the decrypt error text here: it comes from the crypto
      // layer and must not become a path for secret material to reach a log.
      logger?.error?.('Failed to decrypt the WhatsApp API token.');
      return null;
    }
  };

  return {
    getStatus,
    saveToken,
    testConnection,
    getStoredToken,
  };
};

export {
  CONNECTION_STATUS,
  SESSION_OUTCOME,
  CONNECTION_STATUS_BY_OUTCOME,
  WHATSAPP_TOKEN_KEY_SOURCES,
  TOKEN_MASK,
  MIN_TOKEN_LENGTH,
  MAX_TOKEN_LENGTH,
  maskToken,
  normalizePhoneNumber,
  extractConnectedNumber,
  isSessionPayload,
  findSessionSignal,
  mapSessionResponse,
  createWhatsAppSettingsService,
};

export default createWhatsAppSettingsService;
