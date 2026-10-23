import mongoose from 'mongoose';

// Encrypted payload shape for the stored WhatsApp API token. The plaintext
// token is never persisted; only this AES-256-GCM envelope is.
const encryptedSecretSchema = new mongoose.Schema(
  {
    iv: { type: String, default: '' },
    authTag: { type: String, default: '' },
    ciphertext: { type: String, default: '' },
  },
  { _id: false },
);

// Singleton settings document (mirrors SchoolSettings.getSettings() /
// DefaultPasswordSetting.getSettings()) holding the school's WhatsApp API
// token together with the result of the last connection check.
const SETTINGS_KEY = 'whatsapp-settings';

// The connection states surfaced by the Admin Settings UI. `unknown` means the
// provider did not state whether a session exists (or nothing has been checked
// yet) - it is never reported as `connected`.
const CONNECTION_STATUS = {
  NOT_CONFIGURED: 'not_configured',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  UNKNOWN: 'unknown',
  CHECK_FAILED: 'check_failed',
};

const whatsappSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: SETTINGS_KEY,
      unique: true,
      immutable: true,
    },
    // Encrypted provider token. `null`/empty means "not configured".
    apiToken: {
      type: encryptedSecretSchema,
      default: null,
    },
    // Masked display hint (e.g. "****abcd"). Derived from the token at save
    // time so the UI can show which token is stored without ever receiving
    // the token itself.
    tokenHint: {
      type: String,
      default: '',
    },
    // Result of the last connection check. Empty means "never checked".
    connectionStatus: {
      type: String,
      enum: [
        '',
        CONNECTION_STATUS.CONNECTED,
        CONNECTION_STATUS.DISCONNECTED,
        CONNECTION_STATUS.UNKNOWN,
        CONNECTION_STATUS.CHECK_FAILED,
      ],
      default: '',
    },
    // Phone number the provider reports for the connected session, when known.
    connectedNumber: {
      type: String,
      default: '',
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

whatsappSettingsSchema.statics.getSettings = async function () {
  try {
    return await this.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $setOnInsert: { key: SETTINGS_KEY } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  } catch (error) {
    // Two concurrent first-time loads can collide on the unique `key` index.
    // The winning document already exists, so simply read it back.
    if (error?.code === 11000) {
      return this.findOne({ key: SETTINGS_KEY });
    }
    throw error;
  }
};

const WhatsAppSettings = mongoose.model('WhatsAppSettings', whatsappSettingsSchema);

export { SETTINGS_KEY, CONNECTION_STATUS };
export default WhatsAppSettings;
