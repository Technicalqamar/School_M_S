import { randomBytes } from 'node:crypto';
import { ApiError } from '../../utils/apiError.js';

// ─────────────────────────────────────────────────────────────────────────────
// Temporary WhatsApp image hosting.
//
// The WhatsApp provider expects a public image URL. Cloudinary is deliberately
// not used for homework images and nothing is persisted in MongoDB. Instead the
// existing Express backend holds the uploaded bytes in memory for a short time
// and exposes them through an unguessable, temporary GET URL. The provider can
// fetch that URL while the send request is running; the bytes are dropped when
// the entry expires (or when the process restarts).
//
// This store is process-local on purpose. It is appropriate for the single
// long-running Express/Socket.IO server this project deploys; a multi-instance
// deployment would need a shared temporary store instead.
// ─────────────────────────────────────────────────────────────────────────────

export const TEMP_IMAGE_TTL_MS = 15 * 60 * 1000;
export const MAX_TEMP_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TEMP_IMAGE_ENTRIES = 20;
export const MAX_TEMP_IMAGE_TOTAL_BYTES = 25 * 1024 * 1024;

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const IMAGE_ID_PATTERN = /^[a-f0-9]{64}$/;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The browser-supplied MIME type and filename are not trusted. The bytes are
// sniffed so a file renamed to `.jpg` can never be served as HTML/JavaScript.
export const detectImageContentType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

export const isTempImageId = (value) =>
  typeof value === 'string' && IMAGE_ID_PATTERN.test(value);

export const isAllowedImageExtension = (filename) => {
  if (typeof filename !== 'string') return false;
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return false;
  return ALLOWED_IMAGE_EXTENSIONS.has(filename.slice(dot).toLowerCase());
};

/**
 * Build an isolated temporary image store. Every dependency that makes the
 * store time-dependent or random is injectable so it can be tested without a
 * real clock or real random bytes.
 */
export const createTempImageStore = ({
  ttlMs = TEMP_IMAGE_TTL_MS,
  maxEntries = MAX_TEMP_IMAGE_ENTRIES,
  maxTotalBytes = MAX_TEMP_IMAGE_TOTAL_BYTES,
  now = Date.now,
  idFactory = () => randomBytes(32).toString('hex'),
} = {}) => {
  const entries = new Map();

  const prune = () => {
    const timestamp = now();
    for (const [id, entry] of entries) {
      if (entry.expiresAt <= timestamp) entries.delete(id);
    }
  };

  const totalBytes = () => {
    let total = 0;
    for (const entry of entries.values()) total += entry.buffer.length;
    return total;
  };

  const store = ({ buffer } = {}) => {
    prune();

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ApiError(400, 'The selected image is empty.');
    }
    if (buffer.length > MAX_TEMP_IMAGE_BYTES) {
      throw new ApiError(
        413,
        `Image must be smaller than ${MAX_TEMP_IMAGE_BYTES / (1024 * 1024)} MB.`,
      );
    }

    const contentType = detectImageContentType(buffer);
    if (!contentType) {
      throw new ApiError(400, 'Only JPG, PNG, or WebP images are allowed.');
    }

    if (entries.size >= maxEntries) {
      throw new ApiError(
        503,
        'Too many images are waiting to be sent. Try again in a few minutes.',
      );
    }
    if (totalBytes() + buffer.length > maxTotalBytes) {
      throw new ApiError(
        503,
        'Temporary image storage is full. Try again in a few minutes.',
      );
    }

    let id = idFactory();
    while (entries.has(id)) id = idFactory();

    const expiresAt = now() + ttlMs;
    entries.set(id, { buffer, contentType, expiresAt });

    return { id, expiresAt };
  };

  const get = (id) => {
    if (!isTempImageId(id)) return null;

    const entry = entries.get(id);
    if (!entry) return null;

    if (entry.expiresAt <= now()) {
      entries.delete(id);
      return null;
    }

    return { ...entry };
  };

  // Extend a live entry while it is being sent. This keeps the provider's
  // fetch window open without making the image permanent.
  const touch = (id, extensionMs = ttlMs) => {
    if (!isTempImageId(id)) return false;

    const entry = entries.get(id);
    if (!entry) return false;
    if (entry.expiresAt <= now()) {
      entries.delete(id);
      return false;
    }

    entry.expiresAt = Math.max(entry.expiresAt, now() + extensionMs);
    return true;
  };

  const remove = (id) => {
    if (!isTempImageId(id)) return false;
    return entries.delete(id);
  };

  const size = () => {
    prune();
    return entries.size;
  };

  return { store, get, touch, remove, size, totalBytes, prune };
};

// One store per backend process. The singleton is bound to the real clock.
export const tempImageStore = createTempImageStore();

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

/**
 * Resolve the public API base URL (including `/api/v1`) used by the provider.
 *
 * `PUBLIC_API_URL` wins when configured. Otherwise the URL is derived from the
 * request that the admin used, including the usual reverse-proxy headers. This
 * is the real public host in deployment, not a guessed one. A localhost URL is
 * rejected when the image is actually sent because the provider cannot fetch
 * it.
 */
export const getPublicApiBaseUrl = (req) => {
  const configured = String(process.env.PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  const forwardedProto = String(req?.get?.('x-forwarded-proto') || '')
    .split(',')[0]
    .trim();
  const protocol = forwardedProto || req?.protocol || 'http';

  const forwardedHost = String(req?.get?.('x-forwarded-host') || '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || req?.get?.('host') || '';

  if (!host) {
    throw new ApiError(
      503,
      'The backend public URL could not be determined, so the image cannot be shared with WhatsApp.',
    );
  }

  return `${protocol}://${host}/api/v1`;
};

export const buildPublicTempImageUrl = (req, imageId) => {
  if (!isTempImageId(imageId)) {
    throw new ApiError(400, 'Invalid temporary image reference.');
  }

  const base = getPublicApiBaseUrl(req);

  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new ApiError(503, 'PUBLIC_API_URL is not a valid URL.');
  }

  if (LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new ApiError(
      503,
      'The selected image cannot be shared with WhatsApp because the backend is only reachable on localhost. Set PUBLIC_API_URL to the public backend API URL (including /api/v1), or run the backend on a public origin, then try again.',
    );
  }

  return `${base}/whatsapp/homework-diary/image/${imageId}`;
};

export default {
  TEMP_IMAGE_TTL_MS,
  MAX_TEMP_IMAGE_BYTES,
  MAX_TEMP_IMAGE_ENTRIES,
  MAX_TEMP_IMAGE_TOTAL_BYTES,
  detectImageContentType,
  isTempImageId,
  isAllowedImageExtension,
  createTempImageStore,
  tempImageStore,
  getPublicApiBaseUrl,
  buildPublicTempImageUrl,
};
