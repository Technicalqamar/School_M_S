import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TEMP_IMAGE_BYTES,
  TEMP_IMAGE_TTL_MS,
  buildPublicTempImageUrl,
  createTempImageStore,
  detectImageContentType,
  getPublicApiBaseUrl,
  isTempImageId,
} from '../../../src/services/whatsapp/whatsappTempImage.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Temporary homework-image store tests.
//
// No database, network, real clock or real random bytes are used. The tests pin
// the two properties the public image URL depends on: only real image bytes are
// served, and an entry disappears after its short TTL.
// ─────────────────────────────────────────────────────────────────────────────

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
]);

const fixedId = (char = 'a') => char.repeat(64);

const createReq = ({
  protocol = 'https',
  host = 'api.school.test',
  forwardedProto = '',
  forwardedHost = '',
} = {}) => ({
  protocol,
  get(name) {
    if (name === 'host') return host;
    if (name === 'x-forwarded-proto') return forwardedProto;
    if (name === 'x-forwarded-host') return forwardedHost;
    return '';
  },
});

describe('whatsappTempImage service', () => {
  let originalPublicApiUrl;

  beforeEach(() => {
    originalPublicApiUrl = process.env.PUBLIC_API_URL;
    delete process.env.PUBLIC_API_URL;
  });

  afterEach(() => {
    if (originalPublicApiUrl === undefined) {
      delete process.env.PUBLIC_API_URL;
    } else {
      process.env.PUBLIC_API_URL = originalPublicApiUrl;
    }
  });

  describe('detectImageContentType', () => {
    it('detects the allowed image formats from their bytes', () => {
      assert.equal(detectImageContentType(JPEG), 'image/jpeg');
      assert.equal(detectImageContentType(PNG), 'image/png');
      assert.equal(detectImageContentType(WEBP), 'image/webp');
    });

    it('rejects non-image, empty and truncated buffers', () => {
      assert.equal(detectImageContentType(Buffer.from('<html>not an image</html>')), null);
      assert.equal(detectImageContentType(Buffer.alloc(0)), null);
      assert.equal(detectImageContentType(null), null);
      assert.equal(detectImageContentType(Buffer.from([0xff, 0xd8])), null);
    });
  });

  describe('isTempImageId', () => {
    it('accepts only a 64-character lowercase hex token', () => {
      assert.equal(isTempImageId(fixedId('a')), true);
      assert.equal(isTempImageId(fixedId('9')), true);
      assert.equal(isTempImageId('A'.repeat(64)), false);
      assert.equal(isTempImageId('a'.repeat(63)), false);
      assert.equal(isTempImageId('../etc/passwd'), false);
      assert.equal(isTempImageId(null), false);
    });
  });

  describe('createTempImageStore', () => {
    it('stores an image under a random-looking id and returns it before expiry', () => {
      let clock = 1_000;
      const store = createTempImageStore({
        now: () => clock,
        idFactory: () => fixedId('b'),
      });

      const stored = store.store({ buffer: PNG });

      assert.equal(stored.id, fixedId('b'));
      assert.equal(stored.expiresAt, clock + TEMP_IMAGE_TTL_MS);
      assert.equal(store.size(), 1);

      const entry = store.get(stored.id);
      assert.equal(entry.contentType, 'image/png');
      assert.equal(entry.expiresAt, stored.expiresAt);
      assert.deepEqual(entry.buffer, PNG);
    });

    it('drops the image after the TTL and rejects every later lookup', () => {
      let clock = 5_000;
      const store = createTempImageStore({ now: () => clock });

      const { id } = store.store({ buffer: JPEG });
      assert.ok(store.get(id));

      clock += TEMP_IMAGE_TTL_MS + 1;

      assert.equal(store.get(id), null);
      assert.equal(store.size(), 0);
    });

    it('extends a live entry with touch but never revives an expired one', () => {
      let clock = 0;
      const store = createTempImageStore({ now: () => clock });

      const { id } = store.store({ buffer: WEBP });

      clock = TEMP_IMAGE_TTL_MS - 1;
      assert.equal(store.touch(id, TEMP_IMAGE_TTL_MS), true);
      assert.ok(store.get(id));

      clock = TEMP_IMAGE_TTL_MS + 10;
      assert.ok(store.get(id), 'touch should have extended the entry');

      clock += TEMP_IMAGE_TTL_MS + 1;
      assert.equal(store.get(id), null);
    });

    it('removes an image explicitly', () => {
      const store = createTempImageStore();
      const { id } = store.store({ buffer: JPEG });

      assert.equal(store.remove(id), true);
      assert.equal(store.get(id), null);
      assert.equal(store.remove(id), false);
    });

    it('rejects empty, oversized and non-image uploads', () => {
      const store = createTempImageStore();

      assert.throws(() => store.store({ buffer: Buffer.alloc(0) }), (error) => {
        assert.equal(error.statusCode, 400);
        return true;
      });

      const oversized = Buffer.alloc(MAX_TEMP_IMAGE_BYTES + 1);
      oversized[0] = 0xff;
      oversized[1] = 0xd8;
      oversized[2] = 0xff;
      assert.throws(() => store.store({ buffer: oversized }), (error) => {
        assert.equal(error.statusCode, 413);
        return true;
      });

      assert.throws(() => store.store({ buffer: Buffer.from('not an image') }), (error) => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /JPG, PNG, or WebP/);
        return true;
      });
      assert.equal(store.size(), 0);
    });

    it('bounds the number of images waiting to be sent', () => {
      let nextId = 0;
      const store = createTempImageStore({
        maxEntries: 1,
        idFactory: () => (++nextId).toString(16).padStart(64, '0'),
      });

      const first = store.store({ buffer: JPEG });
      assert.throws(() => store.store({ buffer: PNG }), (error) => {
        assert.equal(error.statusCode, 503);
        return true;
      });

      store.remove(first.id);
      assert.doesNotThrow(() => store.store({ buffer: PNG }));
    });

    it('bounds the total bytes held in memory', () => {
      const store = createTempImageStore({ maxTotalBytes: PNG.length });

      store.store({ buffer: PNG });
      assert.equal(store.totalBytes(), PNG.length);

      assert.throws(() => store.store({ buffer: PNG }), (error) => {
        assert.equal(error.statusCode, 503);
        assert.match(error.message, /storage is full/);
        return true;
      });
    });
  });

  describe('public URL resolution', () => {
    it('uses PUBLIC_API_URL when configured and removes trailing slashes', () => {
      process.env.PUBLIC_API_URL = 'https://api.school.test/api/v1///';

      const req = createReq({ host: 'ignored.test' });
      assert.equal(getPublicApiBaseUrl(req), 'https://api.school.test/api/v1');
      assert.equal(
        buildPublicTempImageUrl(req, fixedId('c')),
        `https://api.school.test/api/v1/whatsapp/homework-diary/image/${fixedId('c')}`,
      );
    });

    it('derives the public URL from the request and reverse-proxy headers', () => {
      const req = createReq({
        protocol: 'http',
        host: 'internal:5000',
        forwardedProto: 'https',
        forwardedHost: 'api.school.test',
      });

      assert.equal(getPublicApiBaseUrl(req), 'https://api.school.test/api/v1');
      assert.equal(
        buildPublicTempImageUrl(req, fixedId('d')),
        `https://api.school.test/api/v1/whatsapp/homework-diary/image/${fixedId('d')}`,
      );
    });

    it('rejects localhost because the WhatsApp provider cannot reach it', () => {
      const req = createReq({ protocol: 'http', host: 'localhost:5000' });

      assert.throws(() => buildPublicTempImageUrl(req, fixedId('e')), (error) => {
        assert.equal(error.statusCode, 503);
        assert.match(error.message, /localhost/);
        assert.match(error.message, /PUBLIC_API_URL/);
        return true;
      });
    });

    it('rejects a missing host and an invalid configured URL', () => {
      assert.throws(() => getPublicApiBaseUrl(createReq({ host: '' })), (error) => {
        assert.equal(error.statusCode, 503);
        return true;
      });

      process.env.PUBLIC_API_URL = 'not a url';
      assert.throws(
        () => buildPublicTempImageUrl(createReq(), fixedId('f')),
        (error) => {
          assert.equal(error.statusCode, 503);
          assert.match(error.message, /PUBLIC_API_URL is not a valid URL/);
          return true;
        },
      );
    });

    it('rejects an invalid image id before building a URL', () => {
      process.env.PUBLIC_API_URL = 'https://api.school.test/api/v1';
      assert.throws(() => buildPublicTempImageUrl(createReq(), 'not-a-token'), (error) => {
        assert.equal(error.statusCode, 400);
        return true;
      });
    });
  });
});
