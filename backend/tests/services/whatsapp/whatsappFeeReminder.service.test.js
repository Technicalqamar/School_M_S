import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../../../src/utils/apiError.js';
import { DEFAULT_FEE_REMINDER_TEMPLATE } from '../../../src/utils/feeReminderTemplate.js';
import {
  MAX_WHATSAPP_REMINDER_RECIPIENTS,
  WHATSAPP_REMINDER_REASON,
  WHATSAPP_REMINDER_STATUS,
  createWhatsAppFeeReminderService,
  getEligibility,
  normalizeStudentIds,
  resolveReminderTemplate,
} from '../../../src/services/whatsapp/whatsappFeeReminder.core.js';

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp fee-reminder service tests.
//
// Every dependency is fake: the fee services, student loader, WhatsApp settings
// service and provider client. No database is touched, no environment variable
// is read and no request can leave this process. The fake provider records the
// exact payload so the tests can prove that messages are rendered from the
// server-side ledger context and sent only to the stored WhatsApp number.
// ─────────────────────────────────────────────────────────────────────────────

const contextFor = (studentId, overrides = {}) => {
  const totalOutstanding = overrides.totalOutstanding ?? 12500;
  const fullName = overrides.fullName || 'Ayesha Khan';
  const className = overrides.className || 'Class 4';
  return {
    studentId,
    fullName,
    className,
    academicYear: overrides.academicYear || '2026',
    totalOutstanding,
    hasPortalAccount: true,
    dues: [{ month: 'January', amount: totalOutstanding }],
    context: {
      studentName: fullName,
      studentId,
      className,
      outstanding: totalOutstanding,
      feePeriod: 'January',
      schoolName: 'Green Valley School',
    },
    defaultTemplate: DEFAULT_FEE_REMINDER_TEMPLATE,
    preview: `Preview for ${fullName}`,
    ...overrides,
  };
};

const createFeeReminderService = ({ recipients = [], contexts = {} } = {}) => {
  const calls = { list: [], context: [] };

  return {
    calls,
    async listFeeReminderRecipients(args) {
      calls.list.push(args);
      return {
        academicYear: args.academicYear || '2026',
        classNames: args.classNames || [],
        className: (args.classNames || []).length === 1 ? args.classNames[0] : null,
        defaultTemplate: DEFAULT_FEE_REMINDER_TEMPLATE,
        eligible: recipients,
      };
    },
    async getStudentReminderContext(studentId, academicYear) {
      calls.context.push({ studentId, academicYear });
      const value = contexts[studentId];
      if (!value) throw new ApiError(404, 'Student not found');
      return {
        ...value,
        academicYear: academicYear || value.academicYear,
      };
    },
  };
};

const createSettingsService = ({
  status = 'connected',
  configured = status !== 'not_configured',
  token = 'test-provider-token',
} = {}) => {
  const calls = { getStatus: 0, getStoredToken: 0 };
  return {
    calls,
    async getStatus() {
      calls.getStatus += 1;
      return {
        configured,
        status,
        connectedNumber: '923001234567',
        tokenHint: '****oken',
        lastCheckedAt: null,
        updatedAt: null,
      };
    },
    async getStoredToken() {
      calls.getStoredToken += 1;
      return token;
    },
  };
};

const createClient = ({ failFor = [] } = {}) => {
  const calls = [];
  return {
    calls,
    async sendTextMessage(payload) {
      calls.push(payload);
      if (failFor.includes(payload.to)) {
        // Deliberately include secrets/message text in the thrown error: the
        // service must not echo any of it back to the caller or the logger.
        throw new ApiError(400, `provider rejected ${payload.to} ${payload.token} ${payload.text}`);
      }
      return { ok: true, accepted: true };
    },
  };
};

const createService = ({
  students = [],
  recipients = [],
  contexts = {},
  settings = {},
  client = {},
  loggerCalls = [],
  renderMessage,
} = {}) => {
  const byId = new Map(students.map((student) => [student.studentId, student]));
  const feeReminderService = createFeeReminderService({ recipients, contexts });
  const settingsService = createSettingsService(settings);
  const whatsappClient = createClient(client);

  const service = createWhatsAppFeeReminderService({
    feeReminderService,
    settingsService,
    client: whatsappClient,
    loadStudent: async (studentId) => byId.get(studentId) || null,
    loadStudents: async (studentIds) =>
      studentIds.map((studentId) => byId.get(studentId)).filter(Boolean),
    renderMessage,
    logger: {
      error: (...args) => loggerCalls.push(args),
    },
  });

  return {
    service,
    feeReminderService,
    settingsService,
    client: whatsappClient,
    loggerCalls,
  };
};

const activeStudent = (studentId, overrides = {}) => ({
  studentId,
  fullName: 'Ayesha Khan',
  class: 'Class 4',
  status: 'Active',
  whatsappNumber: '0300-1234567',
  ...overrides,
});

describe('WhatsApp fee reminder eligibility helpers', () => {
  it('requires an active student, a valid WhatsApp number and a positive balance', () => {
    const student = activeStudent('STD-0001');
    assert.deepEqual(
      getEligibility({ student, whatsappNumber: '923001234567', totalOutstanding: 100 }),
      { eligible: true, reason: WHATSAPP_REMINDER_REASON.READY },
    );
    assert.equal(
      getEligibility({ student: { ...student, status: 'Inactive' }, whatsappNumber: '923001234567', totalOutstanding: 100 })
        .reason,
      WHATSAPP_REMINDER_REASON.INACTIVE,
    );
    assert.equal(
      getEligibility({ student, whatsappNumber: '', totalOutstanding: 100 }).reason,
      WHATSAPP_REMINDER_REASON.MISSING_WHATSAPP,
    );
    assert.equal(
      getEligibility({ student, whatsappNumber: '923001234567', totalOutstanding: 0 }).reason,
      WHATSAPP_REMINDER_REASON.NO_DUES,
    );
  });

  it('de-duplicates student IDs and rejects invalid selections', () => {
    assert.deepEqual(normalizeStudentIds(['STD-2', ' STD-1 ', 'STD-2']), ['STD-2', 'STD-1']);
    assert.throws(() => normalizeStudentIds([]), (error) => error.statusCode === 400);
    assert.throws(() => normalizeStudentIds(['']), (error) => error.statusCode === 400);
    assert.throws(() => normalizeStudentIds([42]), (error) => error.statusCode === 400);
    assert.throws(
      () => normalizeStudentIds(Array.from({ length: MAX_WHATSAPP_REMINDER_RECIPIENTS + 1 }, (_, i) => `STD-${i}`)),
      (error) => error.statusCode === 400,
    );
  });

  it('accepts the approved template id or a bounded custom template', () => {
    assert.equal(resolveReminderTemplate({ templateId: 'default' }, 'DEFAULT'), 'DEFAULT');
    assert.equal(resolveReminderTemplate({ templateId: 'fee-reminder-default' }, 'DEFAULT'), 'DEFAULT');
    assert.equal(resolveReminderTemplate({ messageTemplate: '  Hello {{studentName}}  ' }, 'DEFAULT'), 'Hello {{studentName}}');
    assert.throws(() => resolveReminderTemplate({ templateId: 'arbitrary' }, 'DEFAULT'), (error) => error.statusCode === 400);
    assert.throws(() => resolveReminderTemplate({ messageTemplate: 'x'.repeat(2001) }, 'DEFAULT'), (error) => error.statusCode === 400);
  });
});

describe('WhatsApp fee reminder recipients', () => {
  it('enriches the existing outstanding list with the stored WhatsApp number and reasons', async () => {
    const recipients = [
      { studentId: 'STD-1', fullName: 'Ayesha Khan', className: 'Class 4', totalOutstanding: 12500, context: contextFor('STD-1').context, preview: 'Ayesha preview' },
      { studentId: 'STD-2', fullName: 'Bilal Ahmed', className: 'Class 5', totalOutstanding: 5000, context: contextFor('STD-2').context, preview: 'Bilal preview' },
      { studentId: 'STD-3', fullName: 'Inactive Student', className: 'Class 5', totalOutstanding: 800, context: contextFor('STD-3').context, preview: '' },
      { studentId: 'STD-4', fullName: 'No Number', className: 'Class 6', totalOutstanding: 900, context: contextFor('STD-4').context, preview: '' },
    ];
    const students = [
      activeStudent('STD-1', { whatsappNumber: '0300-1234567' }),
      activeStudent('STD-2', { fullName: 'Bilal Ahmed', class: 'Class 5', whatsappNumber: '+92 300 7654321' }),
      activeStudent('STD-3', { status: 'Inactive', whatsappNumber: '923001111111' }),
      activeStudent('STD-4', { whatsappNumber: '' }),
    ];
    const { service, feeReminderService } = createService({ recipients, students });

    const result = await service.getRecipients({
      classNames: ['Class 4', 'Class 5', 'Class 6'],
      academicYear: '2025',
      search: '  Ali  ',
    });

    assert.deepEqual(feeReminderService.calls.list, [
      { classNames: ['Class 4', 'Class 5', 'Class 6'], academicYear: '2025', search: 'Ali' },
    ]);
    assert.equal(result.academicYear, '2025');
    assert.equal(result.eligibleCount, 2);
    assert.equal(result.maxRecipients, MAX_WHATSAPP_REMINDER_RECIPIENTS);
    assert.equal(result.recipients[0].whatsappNumber, '923001234567');
    assert.equal(result.recipients[1].whatsappNumber, '923007654321');
    assert.equal(result.recipients[0].eligible, true);
    assert.equal(result.recipients[2].reason, WHATSAPP_REMINDER_REASON.INACTIVE);
    assert.equal(result.recipients[3].reason, WHATSAPP_REMINDER_REASON.MISSING_WHATSAPP);
    // Only the WhatsApp-specific fields are exposed; no dues/portal data leaks.
    assert.equal('dues' in result.recipients[0], false);
    assert.equal('hasPortalAccount' in result.recipients[0], false);
  });

  it('rejects an unknown class instead of silently returning a different count', async () => {
    const { service, feeReminderService } = createService();
    await assert.rejects(
      service.getRecipients({ classNames: ['Class 99'] }),
      (error) => error.statusCode === 400,
    );
    assert.equal(feeReminderService.calls.list.length, 0);
  });

  it('returns a single preview for the selected academic year and eligibility state', async () => {
    const contexts = { 'STD-1': contextFor('STD-1', { academicYear: '2025' }) };
    const { service, feeReminderService } = createService({
      students: [activeStudent('STD-1')],
      contexts,
    });

    const preview = await service.getStudentPreview('STD-1', { academicYear: '2025' });
    assert.equal(preview.eligible, true);
    assert.equal(preview.whatsappNumber, '923001234567');
    assert.equal(preview.academicYear, '2025');
    assert.equal(feeReminderService.calls.context[0].academicYear, '2025');

    const noDuesService = createService({
      students: [activeStudent('STD-1')],
      contexts: { 'STD-1': contextFor('STD-1', { totalOutstanding: 0 }) },
    }).service;
    const noDues = await noDuesService.getStudentPreview('STD-1', { academicYear: '2025' });
    assert.equal(noDues.eligible, false);
    assert.equal(noDues.reason, WHATSAPP_REMINDER_REASON.NO_DUES);
  });

  it('marks a student without a WhatsApp number as ineligible even if they owe fees', async () => {
    const contexts = { 'STD-1': contextFor('STD-1') };
    const { service } = createService({
      students: [activeStudent('STD-1', { whatsappNumber: '' })],
      contexts,
    });

    const preview = await service.getStudentPreview('STD-1');
    assert.equal(preview.eligible, false);
    assert.equal(preview.reason, WHATSAPP_REMINDER_REASON.MISSING_WHATSAPP);
    assert.equal(preview.whatsappNumber, '');
  });
});

describe('WhatsApp fee reminder sending', () => {
  it('revalidates, renders server-side and sends only to the stored WhatsApp number', async () => {
    const students = [
      activeStudent('STD-1', { whatsappNumber: '0300-1234567' }),
      activeStudent('STD-2', { fullName: 'Bilal Ahmed', whatsappNumber: '+92 300 7654321' }),
    ];
    const contexts = {
      'STD-1': contextFor('STD-1', { totalOutstanding: 12500 }),
      'STD-2': contextFor('STD-2', { fullName: 'Bilal Ahmed', totalOutstanding: 5000 }),
    };
    const { service, client, feeReminderService } = createService({ students, contexts });

    const result = await service.sendReminders({
      studentIds: ['STD-1', 'STD-2', 'STD-1'],
      academicYear: '2025',
      messageTemplate: 'Dear {{studentName}}, your outstanding is PKR {{outstanding}}.',
      // Deliberately ignored client-supplied values. The service must never use
      // these instead of the ledger/service data.
      outstanding: 1,
      to: '920000000000',
    });

    assert.equal(result.recipientCount, 2);
    assert.equal(result.sent, 2);
    assert.equal(result.skipped, 0);
    assert.equal(result.failed, 0);
    assert.deepEqual(
      feeReminderService.calls.context.map((call) => call.academicYear),
      ['2025', '2025'],
    );
    assert.equal(client.calls.length, 2);
    assert.equal(client.calls[0].to, '923001234567');
    assert.equal(client.calls[1].to, '923007654321');
    assert.match(client.calls[0].text, /Ayesha Khan/);
    assert.match(client.calls[0].text, /12,500/);
    assert.match(client.calls[1].text, /Bilal Ahmed/);
    assert.match(client.calls[1].text, /5,000/);
    assert.equal(client.calls[0].token, 'test-provider-token');
    assert.deepEqual(Object.keys(client.calls[0]).sort(), ['text', 'to', 'token']);
  });

  it('reports per-recipient skips and provider failures independently', async () => {
    const students = [
      activeStudent('STD-1', { whatsappNumber: '' }),
      activeStudent('STD-2', { status: 'Inactive' }),
      activeStudent('STD-3'),
      activeStudent('STD-4'),
      activeStudent('STD-5', { whatsappNumber: '923009999999' }),
      activeStudent('STD-6', { whatsappNumber: '923008888888' }),
    ];
    const contexts = {
      'STD-1': contextFor('STD-1'),
      'STD-2': contextFor('STD-2'),
      'STD-3': contextFor('STD-3', { totalOutstanding: 0 }),
      // STD-4 is missing on purpose: the context service throws 404.
      'STD-5': contextFor('STD-5'),
      'STD-6': contextFor('STD-6', { fullName: 'Safe Student' }),
    };
    const loggerCalls = [];
    const { service, client } = createService({
      students,
      contexts,
      client: { failFor: ['923009999999'] },
      loggerCalls,
    });

    const result = await service.sendReminders({
      studentIds: ['STD-1', 'STD-2', 'STD-3', 'STD-4', 'STD-5', 'STD-6', 'STD-404'],
      academicYear: '2026',
      templateId: 'default',
    });

    assert.equal(result.sent, 1);
    assert.equal(result.skipped, 5);
    assert.equal(result.failed, 1);
    assert.deepEqual(
      result.results.map((item) => item.status),
      ['skipped', 'skipped', 'skipped', 'skipped', 'failed', 'sent', 'skipped'],
    );
    assert.equal(result.results[0].reason, WHATSAPP_REMINDER_REASON.NO_WHATSAPP_NUMBER);
    assert.equal(result.results[1].reason, WHATSAPP_REMINDER_REASON.STUDENT_INACTIVE);
    assert.equal(result.results[2].reason, WHATSAPP_REMINDER_REASON.NO_OUTSTANDING_DUES);
    assert.equal(result.results[3].reason, WHATSAPP_REMINDER_REASON.STUDENT_NOT_FOUND);
    assert.equal(result.results[4].reason, WHATSAPP_REMINDER_REASON.PROVIDER_REJECTED);
    assert.equal(result.results[5].status, WHATSAPP_REMINDER_STATUS.SENT);
    assert.equal(result.results[6].reason, WHATSAPP_REMINDER_REASON.STUDENT_NOT_FOUND);
    assert.equal(client.calls.length, 2);

    // The provider error contained the token and message, but neither may leak
    // into the API result or the log.
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /test-provider-token/);
    assert.doesNotMatch(serialized, /Dear /);
    assert.equal(loggerCalls.length, 1);
    assert.doesNotMatch(JSON.stringify(loggerCalls), /test-provider-token/);
    assert.doesNotMatch(JSON.stringify(loggerCalls), /Dear /);
  });

  it('does not call the provider when WhatsApp is not explicitly connected', async () => {
    for (const settings of [
      { status: 'disconnected' },
      { status: 'unknown' },
      { status: 'check_failed' },
      { status: 'not_configured', configured: false, token: null },
    ]) {
      const { service, client } = createService({
        students: [activeStudent('STD-1')],
        contexts: { 'STD-1': contextFor('STD-1') },
        settings,
      });

      await assert.rejects(
        service.sendReminders({ studentIds: ['STD-1'], academicYear: '2026' }),
        (error) => error.statusCode === 409,
      );
      assert.equal(client.calls.length, 0);
    }
  });

  it('fails safely when the stored token is missing or unreadable', async () => {
    const { service, client } = createService({
      students: [activeStudent('STD-1')],
      contexts: { 'STD-1': contextFor('STD-1') },
      settings: { status: 'connected', configured: true, token: null },
    });

    await assert.rejects(
      service.sendReminders({ studentIds: ['STD-1'], academicYear: '2026' }),
      (error) => error.statusCode === 503,
    );
    assert.equal(client.calls.length, 0);
  });

  it('fails closed when the connection status cannot be read', async () => {
    const settingsService = {
      getStatus: async () => {
        throw new Error('database unavailable');
      },
      getStoredToken: async () => 'must-not-be-used',
    };
    const client = createClient();
    const service = createWhatsAppFeeReminderService({
      feeReminderService: createFeeReminderService(),
      settingsService,
      client,
      loadStudent: async () => activeStudent('STD-1'),
      loadStudents: async () => [],
      logger: { error: () => {} },
    });

    await assert.rejects(
      service.sendReminders({ studentIds: ['STD-1'], academicYear: '2026' }),
      (error) => error.statusCode === 503,
    );
    assert.equal(client.calls.length, 0);
  });

  it('reports a render failure per recipient instead of sending an empty message', async () => {
    const { service, client } = createService({
      students: [activeStudent('STD-1')],
      contexts: { 'STD-1': contextFor('STD-1') },
      renderMessage: () => '',
    });

    const result = await service.sendReminders({
      studentIds: ['STD-1'],
      academicYear: '2026',
      messageTemplate: 'Dear {{studentName}}',
    });

    assert.equal(result.failed, 1);
    assert.equal(result.sent, 0);
    assert.equal(result.results[0].reason, WHATSAPP_REMINDER_REASON.RENDER_FAILED);
    assert.equal(client.calls.length, 0);
  });
});
