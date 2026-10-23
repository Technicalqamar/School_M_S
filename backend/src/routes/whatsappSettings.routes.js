import express from 'express';
import {
  getWhatsAppStatus,
  saveWhatsAppToken,
  testWhatsAppConnection,
} from '../controllers/whatsappSettings.controller.js';
import { validateWhatsAppToken } from '../validations/whatsappSettings.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// The WhatsApp API token is a provider credential, so this whole section is
// Admin-only - the same convention the other secret-management endpoints use
// (`defaultPassword.routes.js`: `router.use(protect, authorize('admin'))`).
//
// A Receptionist grant for the ordinary `school-settings` module therefore
// does NOT open the WhatsApp credentials: `requireModuleAccess('school-settings')`
// is deliberately NOT used here. Reading the status, storing a token and
// triggering a connection check all require the `admin` role.
//
// `protect` runs first, so an unauthenticated request is rejected with 401
// before the role is even looked at; `authorize('admin')` then rejects every
// other role with 403 - before the request body is validated or the handler
// is reached.
router.get(
  '/status',
  protect,
  authorize('admin'),
  getWhatsAppStatus,
);

router.put(
  '/token',
  protect,
  authorize('admin'),
  validateWhatsAppToken,
  saveWhatsAppToken,
);

router.post(
  '/test-connection',
  protect,
  authorize('admin'),
  testWhatsAppConnection,
);

export default router;
