import crypto from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated symmetric encryption for secrets that must be retrievable
// (e.g. the Admin-configured default portal passwords, the WhatsApp API
// token). A one-way hash cannot be used because the value has to be sent back
// to the provider, so these values are stored with AES-256-GCM: confidential
// at rest and tamper-evident, while still decryptable for an authorized
// Admin. Account passwords themselves continue to use the existing bcrypt
// hashing flow and are never handled here.
//
// The 32-byte key is derived from a dedicated secret when present, falling back
// to the existing JWT secret so no new deployment configuration is required.
// Each protected secret family gets its own source list, so adding one never
// changes the key used by another.
//
// Falling back to the JWT secret is supported but NOT silent: the fallback is
// reported once per secret family (naming the environment variables only, never
// their values) so an operator knows that rotating the JWT secret would also
// invalidate every value encrypted under it.
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12; // 96-bit nonce, recommended for GCM

// Admin-configured default portal passwords (historical behaviour).
const DEFAULT_KEY_SOURCES = ['DEFAULT_PASSWORD_SECRET', 'JWT_SECRET'];

// The WhatsApp API token is a provider credential that is stored encrypted and
// decrypted again on every connection test, so it gets its own dedicated
// secret. When it is not configured the JWT secret is used as the fallback,
// exactly like the default portal passwords.
const WHATSAPP_TOKEN_KEY_SOURCES = ['WHATSAPP_TOKEN_ENCRYPTION_SECRET', 'JWT_SECRET'];

// Key families whose fallback has already been reported, so the warning is
// logged once instead of on every single encryption/decryption call.
const reportedFallbacks = new Set();

/**
 * A usable secret is a non-empty, non-blank string. A blank environment
 * variable is treated as "not configured" instead of being turned into a key
 * that anybody could derive (the hash of an empty/blank string is a constant).
 */
const isUsableSecret = (value) => typeof value === 'string' && value.trim().length > 0;

/**
 * Resolve the NAME of the environment variable that provides the key. Only the
 * name is returned - the value never leaves this module.
 */
const resolveSecretSource = (keySources) => {
  for (const name of keySources) {
    if (isUsableSecret(process.env[name])) return name;
  }
  return null;
};

/**
 * Report a fallback to a shared secret exactly once per key family. The
 * message names the environment variables only; no secret value is logged.
 */
const warnAboutFallbackKey = (keySources, sourceName, logger) => {
  const family = keySources.join('|');
  if (reportedFallbacks.has(family)) return;
  reportedFallbacks.add(family);

  const log = logger || console;
  log?.warn?.(
    `[secretCrypto] "${keySources[0]}" is not configured; falling back to "${sourceName}". `
      + 'Set a dedicated secret: reusing a shared secret couples its rotation with every '
      + 'value encrypted under it and widens the impact of a leak.',
  );
};

/**
 * Forget the already reported fallbacks. Used by the tests so a warning can be
 * observed more than once.
 */
const resetFallbackWarnings = () => {
  reportedFallbacks.clear();
};

const getKey = (keySources = DEFAULT_KEY_SOURCES, options = {}) => {
  const sourceName = resolveSecretSource(keySources);
  if (!sourceName) {
    // The message names the environment variables only - never a value.
    throw new Error(`No encryption secret configured (${keySources.join(' or ')})`);
  }

  if (sourceName !== keySources[0]) {
    warnAboutFallbackKey(keySources, sourceName, options.logger);
  }

  // Deterministic 32-byte key derived from the configured secret.
  return crypto.createHash('sha256').update(String(process.env[sourceName])).digest();
};

/**
 * Encrypt a plaintext string. Returns the IV, auth tag and ciphertext as hex
 * strings so they can be stored in MongoDB without binary handling.
 *
 * @param {string} plainText
 * @param {{ keySources?: string[], logger?: object }} [options] Optional
 *   key-source override (defaults to the default-portal-password sources) and
 *   an optional logger that receives the fallback warning.
 */
const encryptSecret = (plainText, options = {}) => {
  const keySources = options.keySources || DEFAULT_KEY_SOURCES;
  const iv = crypto.randomBytes(IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(keySources, options), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
};

/**
 * Decrypt a value produced by encryptSecret. Returns null when the payload is
 * missing (i.e. the setting has not been configured).
 *
 * A tampered payload (modified ciphertext, IV or authentication tag) makes the
 * GCM authentication tag check fail, so `decipher.final()` throws instead of
 * returning a forged plaintext.
 *
 * @param {{ iv?: string, authTag?: string, ciphertext?: string } | null} payload
 * @param {{ keySources?: string[], logger?: object }} [options] Optional
 *   key-source override (defaults to the default-portal-password sources) and
 *   an optional logger that receives the fallback warning.
 */
const decryptSecret = (payload, options = {}) => {
  if (!payload || !payload.iv || !payload.authTag || !payload.ciphertext) {
    return null;
  }

  const keySources = options.keySources || DEFAULT_KEY_SOURCES;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(keySources, options), Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return plain.toString('utf8');
};

export {
  encryptSecret,
  decryptSecret,
  DEFAULT_KEY_SOURCES,
  WHATSAPP_TOKEN_KEY_SOURCES,
  resolveSecretSource,
  resetFallbackWarnings,
};
