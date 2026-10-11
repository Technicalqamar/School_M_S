import crypto from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated symmetric encryption for secrets that must be retrievable
// (e.g. the Admin-configured default portal passwords). A one-way hash cannot
// be shown back to an Admin, so these values are stored with AES-256-GCM:
// confidential at rest and tamper-evident, while still decryptable for an
// authorized Admin. Account passwords themselves continue to use the existing
// bcrypt hashing flow and are never handled here.
//
// The 32-byte key is derived from a dedicated secret when present, falling back
// to the existing JWT secret so no new deployment configuration is required.
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12; // 96-bit nonce, recommended for GCM

const getKey = () => {
  const secret = process.env.DEFAULT_PASSWORD_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('No encryption secret configured (DEFAULT_PASSWORD_SECRET or JWT_SECRET)');
  }
  // Deterministic 32-byte key derived from the configured secret.
  return crypto.createHash('sha256').update(String(secret)).digest();
};

/**
 * Encrypt a plaintext string. Returns the IV, auth tag and ciphertext as hex
 * strings so they can be stored in MongoDB without binary handling.
 */
const encryptSecret = (plainText) => {
  const iv = crypto.randomBytes(IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
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
 */
const decryptSecret = (payload) => {
  if (!payload || !payload.iv || !payload.authTag || !payload.ciphertext) {
    return null;
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return plain.toString('utf8');
};

export { encryptSecret, decryptSecret };
