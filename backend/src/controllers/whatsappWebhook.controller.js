import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import whatsappWebhookService from '../services/whatsapp/whatsappWebhook.service.js';

// Receives an incoming provider delivery.
//
// The route applies `express.raw()` before this handler, so `req.body` is the
// exact Buffer that was signed. Without it the raw bytes are gone and the
// signature can no longer be verified, therefore a non-Buffer body is rejected
// instead of being parsed.
//
// The response is always a fixed acknowledgement produced by the service: no
// student data, phone number, message text, event id or provider token is
// returned.
const receiveWhatsAppWebhook = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body)) {
    throw new ApiError(400, 'Webhook request body could not be read.');
  }

  const result = await whatsappWebhookService.handle({
    rawBody: req.body,
    headers: req.headers,
  });

  return res.status(result.status).json(result.body);
});

// Some providers send a GET request to verify the webhook URL exists.
// Respond quickly with a fixed 200 without processing or exposing details.
const verifyWhatsAppWebhook = (req, res) => {
  return res.status(200).json({ success: true, message: 'Webhook endpoint is reachable.' });
};

export { receiveWhatsAppWebhook, verifyWhatsAppWebhook };
export default receiveWhatsAppWebhook;
