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
// Phase 3B processing is opt-in. While
// `WHATSAPP_WEBHOOK_PROCESSING_ENABLED` is not exactly "true", signed
// deliveries are still verified/deduplicated and acknowledged, but no guardian
// matching, data lookup or outbound reply runs. This keeps public processing
// disabled until the provider payload/signature contract is confirmed. The flag
// is read lazily because dotenv runs after module evaluation.
const logger = console;

let processingDisabledLogged = false;

const isProcessingEnabled = () => {
  const value = process.env.WHATSAPP_WEBHOOK_PROCESSING_ENABLED;
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
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
          'WhatsApp webhook message processing is disabled (WHATSAPP_WEBHOOK_PROCESSING_ENABLED).',
        );
      }
      return Promise.resolve({ skipped: true });
    }

    return whatsappAssistantService.handleIncomingMessage(message);
  },
});

export { createWhatsAppWebhookService, createTaskQueue };
export default whatsappWebhookService;
