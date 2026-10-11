import mongoose from 'mongoose';

// Encrypted payload shape for a single stored secret. The plaintext default
// password is never persisted; only this AES-256-GCM envelope is.
const encryptedSecretSchema = new mongoose.Schema(
  {
    iv: { type: String, default: '' },
    authTag: { type: String, default: '' },
    ciphertext: { type: String, default: '' },
  },
  { _id: false },
);

// Singleton settings document (mirrors SchoolSettings.getSettings()) holding the
// Admin-configured default passwords used when a Student/Teacher portal account
// is created automatically.
const SETTINGS_KEY = 'default-portal-passwords';

const defaultPasswordSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: SETTINGS_KEY,
      unique: true,
      immutable: true,
    },
    student: {
      type: encryptedSecretSchema,
      default: null,
    },
    teacher: {
      type: encryptedSecretSchema,
      default: null,
    },
    receptionist: {
      type: encryptedSecretSchema,
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

defaultPasswordSettingSchema.statics.getSettings = async function () {
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

const DefaultPasswordSetting = mongoose.model('DefaultPasswordSetting', defaultPasswordSettingSchema);

export { SETTINGS_KEY };
export default DefaultPasswordSetting;
