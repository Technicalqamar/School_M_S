import {
  createWhatsAppWebhookService,
  createTaskQueue,
} from './whatsappWebhook.core.js';
import whatsappAssistantService from './whatsappAssistant.service.js';

// Binds the webhook logic to the real environment configuration.
//
// The secret is resolved lazily (`getSecret`) on every request, because ES
// module imports are evaluated before `dotenv.config()` runs in app.js. Reading
// it eagerly would always see `undefined` in that setup.
//
// Only a dedicated `WHATSAPP_WEBHOOK_SECRET` is accepted; `WHATSAPP_API_TOKEN`
// is a different credential and is deliberately never used for signing.
//
// Verified messages are acknowledged first and processed in the background by
// the bounded queue (concurrency 1). The queue error hook logs a fixed message
// and never the sender, the message content or provider details.
//
// Processing is opt-in and additionally requires a public backend URL. While
// any of these is missing, signed deliveries are still verified/deduplicated
// and acknowledged, but no guardian matching, data lookup or outbound reply
// runs:
//   * a non-empty WHATSAPP_WEBHOOK_SECRET;
//   * PUBLIC_API_URL pointing at the public backend, including /api/v1;
//   * WHATSAPP_WEBHOOK_PROCESSING_ENABLED=true.
// All values are read lazily because dotenv runs after module evaluation.
const logger = console;

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

let processingDisabledLogged = false;

const hasConfiguredSecret = () => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  return typeof secret === 'string' && secret.trim() !== '';
};

/**
 * Resolve the public webhook URL from the existing public API base URL.
 * Returns '' when the base is missing, malformed, local-only, or does not
 * include the /api/v1 prefix used by this application.
 */
const getPublicWebhookUrl = () => {
  const configured = String(process.env.PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (!configured) return '';

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return '';

  const hostname = parsed.hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.startsWith('127.')) return '';

  const basePath = parsed.pathname.replace(/\/+$/, '');
  if (!basePath.endsWith('/api/v1')) return '';

  return `${parsed.origin}${basePath}/whatsapp/webhook`;
};

const isProcessingEnabled = () => {
  const value = process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
  if (typeof value !== 'string' || value.trim().toLowerCase() !== 'true') return false;
  if (!hasConfiguredSecret()) return false;
  return Boolean(getPublicWebhookUrl());
};

const queue = createTaskQueue({
  concurrency: 1,
  maxPending: 100,
  onError: () => {
    logger?.error?.('WhatsApp webhook message processing failed.');
  },
});

const whatsappWebhookService = createWhatsAppWebhookService({
  getSecret: () => process.env.WHATSAPP_WEBHOOK_SECRET,
  logger,
  enqueue: (task) => queue.push(task),
  processMessage: (message) => {
    if (!isProcessingEnabled()) {
      if (!processingDisabledLogged) {
        processingDisabledLogged = true;
        logger?.warn?.(
          'WhatsApp webhook message processing is disabled until the webhook secret, PUBLIC_API_URL and WHATSAPP_WEBHOOK_PROCESSING_ENABLED are configured.',
        );
      }
      return Promise.resolve({ skipped: true });
    }

    return whatsappAssistantService.handleIncomingMessage(message);
  },
});

export {
  createWhatsAppWebhookService,
  createTaskQueue,
  getPublicWebhookUrl,
  hasConfiguredSecret,
  isProcessingEnabled,
};
export default whatsappWebhookService;
