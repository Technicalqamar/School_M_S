import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../../src/utils/apiError.js';
import {
  HOMEWORK_DIARY_REASON,
  HOMEWORK_DIARY_STATUS,
  MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS,
  buildHomeworkDiaryCaption,
  createWhatsAppHomeworkDiaryService,
  normalizeStudentIds,
  validateHomeworkDiaryImageUrl,
} from '../../../src/services/whatsapp/whatsappHomeworkDiary.core.js';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Homework Diary send-service tests.
//
// Every dependency is fake: the recipient/eligibility service, the WhatsApp
// settings service and the provider client. No database is touched, no
// environment variable is read and no request can leave this process. The fake
// provider records the exact payload so the tests can prove that:
//   * the image URL and caption are sent to the dedicated stored number;
//   * a student who is no longer eligible is skipped, not contacted;
//   * a provider failure for one student does not prevent the others.
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_URL = `https://api.school.test/api/v1/whatsapp/homework-diary/image/${'a'.repeat(64)}`;

const recipient = (studentId, overrides = {}) => ({
  studentId,
  fullName: `Student ${studentId}`,
  className: 'Class 4',
  whatsappNumber: '923001234567',
  eligible: true,
  reason: 'ready',
  ...overrides,
});

const createHarness = ({
  recipients = [],
  status = 'connected',
  token = 'test-provider-token',
  failFor = [],
  logger,
} = {}) => {
  const calls = {
    status: 0,
    storedToken: 0,
    recipientQueries: [],
    provider: [],
    beforeSend: 0,
  };

  const settingsService = {
    async getStatus() {
      calls.status += 1;
      return { status };
    },
    async getStoredToken() {
      calls.storedToken += 1;
      return token;
    },
  };

  const client = {
    async sendTextMessage(payload) {
      calls.provider.push(payload);
      if (failFor.includes(payload.to)) {
        // Deliberately include secrets and the caption: the service must never
        // echo any of it back in the result or the logger.
        throw new ApiError(400, `provider secret ${payload.token} ${payload.text}`);
      }
      return { ok: true, accepted: true };
    },
  };

  const getRecipients = async (args) => {
    calls.recipientQueries.push(args);
    return {
      academicYear: args.academicYear || '2026',
      classNames: Array.isArray(args.classNames) ? args.classNames : [],
      recipients,
      eligibleCount: recipients.filter((item) => item.eligible).length,
      maxRecipients: 100,
    };
  };

  const service = createWhatsAppHomeworkDiaryService({
    getRecipients,
    settingsService,
    client,
    logger: logger || { error() {} },
  });

  return { service, calls };
};

const send = (service, overrides = {}) =>
  service.sendHomeworkDiary({
    studentIds: ['STD-1', 'STD-2'],
    classNames: ['Class 4'],
    academicYear: '2026',
    title: 'Math Exercise 5',
    message: 'Bring your notebook',
    imageUrl: IMAGE_URL,
    ...overrides,
  });

describe('whatsappHomeworkDiary core validation', () => {
  it('requires a non-empty array of unique student IDs and caps the batch at 100', () => {
    assert.deepEqual(normalizeStudentIds([' STD-1 ', 'STD-1', 'STD-2']), ['STD-1', 'STD-2']);

    assert.throws(() => normalizeStudentIds(undefined), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
    assert.throws(() => normalizeStudentIds([]), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
    assert.throws(() => normalizeStudentIds(['']), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });

    const tooMany = Array.from(
      { length: MAX_WHATSAPP_HOMEWORK_DIARY_RECIPIENTS + 1 },
      (_, index) => `STD-${index}`,
    );
    assert.throws(() => normalizeStudentIds(tooMany), (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /at most 100/);
      return true;
    });
  });

  it('builds the caption from the title and optional message', () => {
    assert.equal(buildHomeworkDiaryCaption({ title: '  Math  ' }), 'Math');
    assert.equal(
      buildHomeworkDiaryCaption({ title: 'Math', message: '  Bring a notebook  ' }),
      'Math\n\nBring a notebook',
    );

    assert.throws(() => buildHomeworkDiaryCaption({ title: '   ' }), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
    assert.throws(
      () => buildHomeworkDiaryCaption({ title: 'Math', message: 42 }),
      (error) => {
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
    assert.throws(
      () => buildHomeworkDiaryCaption({ title: 'a'.repeat(201) }),
      (error) => {
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  it('accepts only a plausible temporary HTTP(S) image URL', () => {
    assert.equal(validateHomeworkDiaryImageUrl(`  ${IMAGE_URL}  `), IMAGE_URL);
    for (const value of [undefined, '', 'not-a-url', 'ftp://api.test/image.png']) {
      assert.throws(() => validateHomeworkDiaryImageUrl(value), (error) => {
        assert.equal(error.statusCode, 400);
        return true;
      });
    }
  });
});

describe('whatsappHomeworkDiary sendHomeworkDiary', () => {
  it('sends the image URL and caption only to selected eligible students', async () => {
    const { service, calls } = createHarness({
      recipients: [
        recipient('STD-1', { whatsappNumber: '923001111111' }),
        recipient('STD-2', { whatsappNumber: '923002222222' }),
        recipient('STD-3', { whatsappNumber: '923003333333' }),
      ],
    });

    let beforeSendCount = 0;
    const result = await service.sendHomeworkDiary({
      studentIds: ['STD-1', 'STD-2', 'STD-4'],
      classNames: ['Class 4'],
      academicYear: '2026',
      title: 'Math Exercise 5',
      message: 'Bring your notebook',
      imageUrl: IMAGE_URL,
      onBeforeSend: () => {
        beforeSendCount += 1;
      },
    });

    assert.deepEqual(calls.recipientQueries, [
      { classNames: ['Class 4'], className: undefined, academicYear: '2026' },
    ]);
    assert.equal(calls.provider.length, 2);
    assert.equal(beforeSendCount, 2);
    assert.deepEqual(calls.provider[0], {
      to: '923001111111',
      image: IMAGE_URL,
      text: 'Math Exercise 5\n\nBring your notebook',
      token: 'test-provider-token',
    });
    assert.deepEqual(calls.provider[1], {
      to: '923002222222',
      image: IMAGE_URL,
      text: 'Math Exercise 5\n\nBring your notebook',
      token: 'test-provider-token',
    });

    assert.equal(result.academicYear, '2026');
    assert.deepEqual(result.classNames, ['Class 4']);
    assert.equal(result.recipientCount, 3);
    assert.equal(result.eligibleCount, 3);
    assert.equal(result.sent, 2);
    assert.equal(result.skipped, 1);
    assert.equal(result.failed, 0);
    assert.deepEqual(
      result.results.map((row) => [row.studentId, row.status]),
      [
        ['STD-1', HOMEWORK_DIARY_STATUS.SENT],
        ['STD-2', HOMEWORK_DIARY_STATUS.SENT],
        ['STD-4', HOMEWORK_DIARY_STATUS.SKIPPED],
      ],
    );
    assert.equal(result.results[2].reason, HOMEWORK_DIARY_REASON.NOT_ELIGIBLE);
    assert.ok(!('STD-3' in Object.fromEntries(result.results.map((row) => [row.studentId, row]))));
  });

  it('sends only the title when no message is provided', async () => {
    const { service, calls } = createHarness({
      recipients: [recipient('STD-1')],
    });

    const result = await send(service, {
      studentIds: ['STD-1'],
      message: undefined,
    });

    assert.equal(result.sent, 1);
    assert.equal(calls.provider[0].text, 'Math Exercise 5');
  });

  it('skips a selected recipient who became ineligible or has no number', async () => {
    const { service, calls } = createHarness({
      recipients: [
        recipient('STD-1'),
        recipient('STD-2', { eligible: false, whatsappNumber: '' }),
        recipient('STD-3', { whatsappNumber: '' }),
      ],
    });

    const result = await send(service, {
      studentIds: ['STD-1', 'STD-2', 'STD-3'],
    });

    assert.equal(calls.provider.length, 1);
    assert.equal(result.sent, 1);
    assert.equal(result.skipped, 2);
    assert.equal(result.results[1].reason, HOMEWORK_DIARY_REASON.NOT_ELIGIBLE);
    assert.equal(result.results[2].reason, HOMEWORK_DIARY_REASON.MISSING_WHATSAPP);
  });

  it('does not contact the provider when WhatsApp is not connected', async () => {
    const { service, calls } = createHarness({ status: 'disconnected' });

    await assert.rejects(() => send(service), (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /not connected/);
      return true;
    });

    assert.equal(calls.status, 1);
    assert.equal(calls.storedToken, 0);
    assert.equal(calls.recipientQueries.length, 0);
    assert.equal(calls.provider.length, 0);
  });

  it('does not contact the provider when the stored token is unavailable', async () => {
    const { service, calls } = createHarness({ token: null });

    await assert.rejects(() => send(service), (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /stored WhatsApp API token/);
      return true;
    });

    assert.equal(calls.recipientQueries.length, 0);
    assert.equal(calls.provider.length, 0);
  });

  it('returns a safe failure for one recipient without aborting the others', async () => {
    const logCalls = [];
    const { service, calls } = createHarness({
      recipients: [
        recipient('STD-1', { whatsappNumber: '923001111111' }),
        recipient('STD-2', { whatsappNumber: '923002222222' }),
      ],
      failFor: ['923002222222'],
      logger: {
        error(...args) {
          logCalls.push(args);
        },
      },
    });

    const result = await send(service);

    assert.equal(calls.provider.length, 2);
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.results[0].status, HOMEWORK_DIARY_STATUS.SENT);
    assert.equal(result.results[1].status, HOMEWORK_DIARY_STATUS.FAILED);
    assert.equal(result.results[1].reason, HOMEWORK_DIARY_REASON.PROVIDER_REJECTED);

    // The provider error contained the token and caption. Neither may leak into
    // the API response or the logger.
    const serializedResult = JSON.stringify(result);
    const serializedLogs = JSON.stringify(logCalls);
    assert.doesNotMatch(serializedResult, /provider secret|test-provider-token|Bring your notebook/);
    assert.doesNotMatch(serializedLogs, /provider secret|test-provider-token|Bring your notebook/);
  });

  it('deduplicates repeated student IDs before contacting the provider', async () => {
    const { service, calls } = createHarness({
      recipients: [recipient('STD-1')],
    });

    const result = await send(service, {
      studentIds: ['STD-1', 'STD-1'],
    });

    assert.equal(calls.provider.length, 1);
    assert.equal(result.recipientCount, 1);
    assert.equal(result.sent, 1);
  });

  it('rejects invalid input before reading settings or loading recipients', async () => {
    const { service, calls } = createHarness({
      recipients: [recipient('STD-1')],
    });

    await assert.rejects(() => send(service, { studentIds: [] }), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
    await assert.rejects(() => send(service, { title: '   ' }), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });
    await assert.rejects(() => send(service, { imageUrl: '' }), (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    });

    assert.equal(calls.status, 0);
    assert.equal(calls.recipientQueries.length, 0);
    assert.equal(calls.provider.length, 0);
  });
});
