import WhatsAppSettings from '../../models/whatsappSettings.model.js';
import AuditLog from '../../models/auditLog.model.js';
import { encryptSecret, decryptSecret } from '../../utils/secretCrypto.js';
import whatsappClient from './whatsappClient.service.js';
import { createWhatsAppSettingsService } from './whatsappSettings.core.js';

// Binds the WhatsApp settings logic to the real dependencies: the Mongoose
// settings document, the AES-256-GCM helpers and the WhatsApp API client.
const whatsappSettingsService = createWhatsAppSettingsService({
  model: WhatsAppSettings,
  encrypt: encryptSecret,
  decrypt: decryptSecret,
  client: whatsappClient,
  audit: async (entry) => {
    await AuditLog.create(entry);
  },
});

export { createWhatsAppSettingsService };
export default whatsappSettingsService;
