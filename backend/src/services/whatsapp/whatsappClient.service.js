import { ApiError } from '../../utils/apiError.js';

const BASE_URL = 'https://whatsapp.qasimhussain.com/api';
const DEFAULT_TIMEOUT_MS = 30000;

// The token may be supplied by the caller (the Admin-configured token that is
// stored encrypted in the database) and falls back to the environment variable.
const getToken = (explicitToken) => {
  const token = explicitToken || process.env.WHATSAPP_API_TOKEN;
  if (!token) {
    throw new ApiError(500, 'WhatsApp API token is not configured');
  }
  return token;
};

const createAbortController = (timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
};

const sanitizeErrorMessage = (message, explicitToken) => {
  if (!message) return 'WhatsApp API request failed';
  // Both the explicitly supplied token and the environment token are redacted,
  // so a provider error can never echo the credential back to the caller.
  const secrets = [explicitToken, process.env.WHATSAPP_API_TOKEN].filter(Boolean);
  let safe = String(message);
  for (const secret of secrets) {
    safe = safe.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
  }
  return safe;
};

const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  const phoneStr = String(phone).trim();
  if (!phoneStr) return false;
  const cleaned = phoneStr.replace(/[\s\-\(\)]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
    return false;
  }
  return true;
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  const phoneStr = String(phone).trim();
  if (!phoneStr) return null;
  return phoneStr.replace(/[\s\-\(\)]/g, '');
};

const checkSession = async (options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const token = getToken(options.token);

  const { controller, timeout } = createAbortController(timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}/session`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new ApiError(502, 'Invalid response from WhatsApp API');
    }

    if (!response.ok) {
      const message = sanitizeErrorMessage(data?.message || data?.error || `WhatsApp API error: ${response.status}`, token);
      throw new ApiError(response.status, message);
    }

    if (data && data.ok === false) {
      const message = sanitizeErrorMessage(data?.message || data?.error || 'WhatsApp API request failed', token);
      throw new ApiError(400, message);
    }

    return data;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new ApiError(504, 'WhatsApp API request timeout');
    }

    if (error instanceof ApiError) {
      throw error;
    }

    const message = sanitizeErrorMessage(error.message || 'WhatsApp API request failed', token);
    throw new ApiError(502, message);
  }
};

const sendTextMessage = async (params = {}) => {
  const { to, text, message, image, document, filename, audio, voice, timeoutMs = DEFAULT_TIMEOUT_MS } = params;

  if (!to) {
    throw new ApiError(400, 'Recipient phone number is required');
  }

  if (!isValidPhoneNumber(to)) {
    throw new ApiError(400, 'Invalid phone number format');
  }

  const messageContent = text !== undefined ? text : message;

  if (!messageContent && !image && !document && !audio && !voice) {
    throw new ApiError(400, 'Message content is required');
  }

  const token = getToken(params.token);
  const normalizedTo = normalizePhoneNumber(to);

  const payload = {
    to: normalizedTo,
  };

  if (messageContent) {
    payload.text = String(messageContent);
  }
  if (image) {
    payload.image = image;
  }
  if (document) {
    payload.document = document;
  }
  if (filename) {
    payload.filename = filename;
  }
  if (audio) {
    payload.audio = audio;
  }
  if (voice) {
    payload.voice = voice;
  }

  const { controller, timeout } = createAbortController(timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new ApiError(502, 'Invalid response from WhatsApp API');
    }

    if (!response.ok) {
      const message = sanitizeErrorMessage(data?.message || data?.error || `WhatsApp API error: ${response.status}`, token);
      throw new ApiError(response.status, message);
    }

    if (data && data.ok === false) {
      const message = sanitizeErrorMessage(data?.message || data?.error || 'WhatsApp API request failed', token);
      throw new ApiError(400, message);
    }

    return data;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new ApiError(504, 'WhatsApp API request timeout');
    }

    if (error instanceof ApiError) {
      throw error;
    }

    const message = sanitizeErrorMessage(error.message || 'WhatsApp API request failed', token);
    throw new ApiError(502, message);
  }
};

export default {
  checkSession,
  sendTextMessage,
  isValidPhoneNumber,
  normalizePhoneNumber,
};
