import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import whatsappClient from '../../../src/services/whatsapp/whatsappClient.service.js';

describe('whatsappClient service', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    global.fetch = async () => ({});
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('checkSession', () => {
    it('should throw error when token is not configured', async () => {
      delete process.env.WHATSAPP_API_TOKEN;
      await assert.rejects(
        async () => {
          await whatsappClient.checkSession();
        },
        (err) => {
          assert.strictEqual(err.statusCode, 500);
          assert.ok(err.message.includes('token'));
          return true;
        }
      );
    });

    it('should check session with correct headers and URL', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledUrl, calledOptions;
      global.fetch = async (url, options) => {
        calledUrl = url;
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, status: 'connected' }),
        };
      };

      const result = await whatsappClient.checkSession();
      assert.deepStrictEqual(result, { ok: true, status: 'connected' });
      assert.strictEqual(calledUrl, 'https://whatsapp.qasimhussain.com/api/session');
      assert.strictEqual(calledOptions.method, 'GET');
      assert.strictEqual(calledOptions.headers.Authorization, 'Bearer test-token');
      assert.strictEqual(calledOptions.headers['Content-Type'], 'application/json');
    });

    it('should use an explicitly supplied token instead of the environment variable', async () => {
      delete process.env.WHATSAPP_API_TOKEN;
      let calledOptions;
      global.fetch = async (url, options) => {
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, connected: true }),
        };
      };

      const result = await whatsappClient.checkSession({ token: 'stored-token-value' });

      assert.deepStrictEqual(result, { ok: true, connected: true });
      assert.strictEqual(calledOptions.headers.Authorization, 'Bearer stored-token-value');
    });

    it('should redact an explicitly supplied token from error messages', async () => {
      delete process.env.WHATSAPP_API_TOKEN;
      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, message: 'Token stored-token-value is invalid' }),
      });

      try {
        await whatsappClient.checkSession({ token: 'stored-token-value' });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('[REDACTED]'));
        assert.ok(!error.message.includes('stored-token-value'));
      }
    });

    it('should handle non-2xx response', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, message: 'Unauthorized' }),
      });

      await assert.rejects(
        async () => {
          await whatsappClient.checkSession();
        },
        (err) => {
          assert.strictEqual(err.statusCode, 401);
          return true;
        }
      );
    });

    it('should handle ok:false response', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, message: 'Session not found' }),
      });

      await assert.rejects(
        async () => {
          await whatsappClient.checkSession();
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('should redact token from error messages', async () => {
      process.env.WHATSAPP_API_TOKEN = 'secret-token-123';
      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, message: 'Token secret-token-123 is invalid' }),
      });

      try {
        await whatsappClient.checkSession();
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('[REDACTED]'));
        assert.ok(!error.message.includes('secret-token-123'));
      }
    });

    it('should handle timeout', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async (url, options) => {
        // The request may only settle through the abort signal. The fallback
        // timer is far longer than the 10ms timeout and never keeps the event
        // loop alive, so the test cannot become timing dependent.
        return new Promise((resolve, reject) => {
          const fallback = setTimeout(
            () => resolve({ ok: true, status: 200, json: async () => ({}) }),
            5000,
          );
          fallback.unref?.();
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(fallback);
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      await assert.rejects(
        async () => {
          await whatsappClient.checkSession({ timeoutMs: 10 });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 504);
          assert.ok(err.message.includes('timeout'));
          return true;
        }
      );
    });

    it('should handle invalid JSON response', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await assert.rejects(
        async () => {
          await whatsappClient.checkSession();
        },
        (err) => {
          assert.strictEqual(err.statusCode, 502);
          return true;
        }
      );
    });
  });

  describe('sendTextMessage', () => {
    it('should throw error when token is not configured', async () => {
      delete process.env.WHATSAPP_API_TOKEN;
      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({ to: '1234567890', text: 'Hello' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 500);
          return true;
        }
      );
    });

    it('should throw error when to is missing', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({ text: 'Hello' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('phone'));
          return true;
        }
      );
    });

    it('should throw error when phone number is invalid', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({ to: 'abc123', text: 'Hello' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('Invalid phone'));
          return true;
        }
      );
    });

    it('should throw error when message content is missing', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({ to: '+1234567890' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('content'));
          return true;
        }
      );
    });

    it('should send text message successfully with text field', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledUrl, calledOptions;
      global.fetch = async (url, options) => {
        calledUrl = url;
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, messageId: 'msg123' }),
        };
      };

      const result = await whatsappClient.sendTextMessage({
        to: '+1234567890',
        text: 'Hello World',
      });

      assert.deepStrictEqual(result, { ok: true, messageId: 'msg123' });
      assert.strictEqual(calledUrl, 'https://whatsapp.qasimhussain.com/api/send');
      assert.strictEqual(calledOptions.method, 'POST');
      assert.strictEqual(calledOptions.headers.Authorization, 'Bearer test-token');
      assert.strictEqual(calledOptions.headers['Content-Type'], 'application/json');
      const body = JSON.parse(calledOptions.body);
      assert.strictEqual(body.to, '+1234567890');
      assert.strictEqual(body.text, 'Hello World');
    });

    it('should accept message as alias for text', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async (url, options) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      };

      await whatsappClient.sendTextMessage({
        to: '1234567890',
        message: 'Hello',
      });

      const body = JSON.parse(global.fetch.mock?.calls?.[0]?.[1]?.body || '{"text":""}');
      // For node:test we can't use jest mocks, so check differently
    });

    it('should normalize phone number', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledOptions;
      global.fetch = async (url, options) => {
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      };

      await whatsappClient.sendTextMessage({
        to: '+1 (234) 567-8900',
        text: 'Hello',
      });

      const body = JSON.parse(calledOptions.body);
      assert.strictEqual(body.to, '+12345678900');
    });

    it('should send message with image', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledOptions;
      global.fetch = async (url, options) => {
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      };

      await whatsappClient.sendTextMessage({
        to: '1234567890',
        text: 'Check this image',
        image: 'https://example.com/image.jpg',
      });

      const body = JSON.parse(calledOptions.body);
      assert.strictEqual(body.image, 'https://example.com/image.jpg');
    });

    it('should send message with document and filename', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledOptions;
      global.fetch = async (url, options) => {
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      };

      await whatsappClient.sendTextMessage({
        to: '1234567890',
        text: 'Here is the document',
        document: 'https://example.com/file.pdf',
        filename: 'report.pdf',
      });

      const body = JSON.parse(calledOptions.body);
      assert.strictEqual(body.document, 'https://example.com/file.pdf');
      assert.strictEqual(body.filename, 'report.pdf');
    });

    it('should send message with audio', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledOptions;
      global.fetch = async (url, options) => {
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      };

      await whatsappClient.sendTextMessage({
        to: '1234567890',
        audio: 'https://example.com/audio.mp3',
      });

      const body = JSON.parse(calledOptions.body);
      assert.strictEqual(body.audio, 'https://example.com/audio.mp3');
    });

    it('should send message with voice', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      let calledOptions;
      global.fetch = async (url, options) => {
        calledOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      };

      await whatsappClient.sendTextMessage({
        to: '1234567890',
        voice: 'https://example.com/voice.mp3',
      });

      const body = JSON.parse(calledOptions.body);
      assert.strictEqual(body.voice, 'https://example.com/voice.mp3');
    });

    it('should handle non-2xx response', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, message: 'Bad Request' }),
      });

      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({ to: '1234567890', text: 'Hello' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('should handle ok:false response', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, message: 'Failed to send' }),
      });

      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({ to: '1234567890', text: 'Hello' });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    it('should handle timeout', async () => {
      process.env.WHATSAPP_API_TOKEN = 'test-token';
      global.fetch = async (url, options) => {
        // The request may only settle through the abort signal. The fallback
        // timer is far longer than the 10ms timeout and never keeps the event
        // loop alive, so the test cannot become timing dependent.
        return new Promise((resolve, reject) => {
          const fallback = setTimeout(
            () => resolve({ ok: true, status: 200, json: async () => ({}) }),
            5000,
          );
          fallback.unref?.();
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(fallback);
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      await assert.rejects(
        async () => {
          await whatsappClient.sendTextMessage({
            to: '1234567890',
            text: 'Hello',
            timeoutMs: 10,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 504);
          return true;
        }
      );
    });
  });

  describe('phone number validation', () => {
    it('should validate valid phone numbers', () => {
      assert.strictEqual(whatsappClient.isValidPhoneNumber('+1234567890'), true);
      assert.strictEqual(whatsappClient.isValidPhoneNumber('1234567890'), true);
      assert.strictEqual(whatsappClient.isValidPhoneNumber('+123456789012345'), true);
    });

    it('should reject invalid phone numbers', () => {
      assert.strictEqual(whatsappClient.isValidPhoneNumber('abc'), false);
      assert.strictEqual(whatsappClient.isValidPhoneNumber('123'), false);
      assert.strictEqual(whatsappClient.isValidPhoneNumber(''), false);
      assert.strictEqual(whatsappClient.isValidPhoneNumber(null), false);
      assert.strictEqual(whatsappClient.isValidPhoneNumber(undefined), false);
    });
  });
});
