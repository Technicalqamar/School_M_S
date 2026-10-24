import express from 'express';
import {
  receiveWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from '../controllers/whatsappWebhook.controller.js';

const router = express.Router();

// Incoming provider deliveries are authenticated by the HMAC signature on the
// raw body, NOT by a user session, so this router is deliberately not guarded
// by `protect` / `authorize`.
//
// `express.raw()` is scoped to this router and accepts any content type so the
// exact bytes reach the handler untouched. The router is mounted in app.js
// BEFORE the global `express.json()` middleware; otherwise the JSON parser
// would consume the body and the original bytes could not be verified.
//
// The 256kb limit matches MAX_BODY_BYTES in the webhook core.
const captureRawBody = express.raw({ type: () => true, limit: '256kb' });

// Some providers validate webhook URLs with a GET request. Respond quickly
// without consuming or logging the body or secrets.
router.get('/', verifyWhatsAppWebhook);

router.post('/', captureRawBody, receiveWhatsAppWebhook);

export default router;
