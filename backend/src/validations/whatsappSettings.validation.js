import { ApiError } from '../utils/apiError.js';

// Validation for the WhatsApp API token. The token is a provider credential, so
// it is validated for shape only - its value is never logged and never echoed
// back in an error message.
const MIN_TOKEN_LENGTH = 8;
const MAX_TOKEN_LENGTH = 512;

const validateWhatsAppToken = (req, res, next) => {
  const { apiToken } = req.body || {};

  if (typeof apiToken !== 'string' || !apiToken.trim()) {
    throw new ApiError(400, 'WhatsApp API token is required and must be a non-empty string');
  }

  const token = apiToken.trim();

  if (token.length < MIN_TOKEN_LENGTH) {
    throw new ApiError(400, `WhatsApp API token must be at least ${MIN_TOKEN_LENGTH} characters`);
  }

  if (token.length > MAX_TOKEN_LENGTH) {
    throw new ApiError(400, `WhatsApp API token must be at most ${MAX_TOKEN_LENGTH} characters`);
  }

  if (/\s/.test(token)) {
    throw new ApiError(400, 'WhatsApp API token must not contain whitespace');
  }

  // Store the normalized value so the encrypted payload never contains
  // accidental leading/trailing whitespace.
  req.body.apiToken = token;

  return next();
};

export { validateWhatsAppToken, MIN_TOKEN_LENGTH, MAX_TOKEN_LENGTH };
export default validateWhatsAppToken;
