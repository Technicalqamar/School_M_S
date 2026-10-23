import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildPortalUser,
  createWhatsAppAssistantService,
} from '../../src/services/whatsapp/whatsappAssistant.service.js';
import { createConversationStore } from '../../src/services/whatsapp/whatsappConversation.core.js';

// ---------------------------------------------------------------------------
// Service-boundary tests.
//
// These prove that the WhatsApp layer:
//   * gives the existing portal services ONLY the guardian-verified student id,
//   * never passes a student id or phone number taken from the message,
//   * sends replies only to the verified sender, using the stored token,
//   * keeps provider/token failures quiet and PII-free.
// ---------------------------------------------------------------------------

const SENDER = '923001234567';
const OTHER_STUDENT_ID = '64b000000000000000000009';

const STUDENT = {
  id: '64b000000000000000000001',
  studentId: 'STD-001',
  fullName: 'Ali Khan',
  class: 'Class 3',
};

const createDeps = (overrides = {}) => {
  const calls = {
    fee: [],
    attendance: [],
    exam: [],
    client: [],
    tokenReads: 0,
  };
  const logs = [];
  const guardianCalls = [];

  const guardian = {
    async findMatches(phone) {
      guardianCalls.push(phone);
      return { canonicalPhone: phone, students: overrides.students || [STUDENT] };
    },
  };

  const feeService = {
    async getMyFeeOverview(user) {
      calls.fee.push(user);
      return {
        currentAcademicYear: '2026',
        currentMonth: 'October',
        currentFeeAmount: 2000,
        paidAmount: 500,
        outstandingAmount: 4500,
        outstandingCount: 2,
        dueDate: '2026-10-10',
        paymentStatus: 'Partial',
      };
    },
  };

  const attendanceService = {
    async getMyAttendance(user, context, filters) {
      calls.attendance.push({ user, context, filters });
      return {
        academicYear: '2026',
        summary: { present: 20, absent: 2, late: 1, leave: 1, total: 24 },
        records: [{ date: '2026-10-01', status: 'Present' }],
      };
    },
  };

  const examService = {
    async getMyResults(user, context, params) {
      calls.exam.push({ user, context, params });
      return {
        academicYear: '2026',
        results: [
          { exam: { name: 'Mid Term', type: 'Mid Term' }, percentage: 78.5, grade: 'B', status: 'Passed' },
        ],
      };
    },
  };

  const client = {
    async sendTextMessage(params) {
      calls.client.push(params);
      if (overrides.clientError) throw new Error('provider rejected the request');
      return { ok: true };
    },
  };

  const getToken =
    overrides.getToken ||
    (async () => {
      calls.tokenReads += 1;
      return 'stored-provider-token';
    });

  const service = createWhatsAppAssistantService({
    guardian,
    conversations: overrides.conversations || createConversationStore(),
    feeService: overrides.feeService || feeService,
    attendanceService: overrides.attendanceService || attendanceService,
    examService: overrides.examService || examService,
    client,
    getToken,
    logger: { error: (message) => logs.push(String(message)) },
  });

  const incoming = (text, sender = SENDER) =>
    service.handleIncomingMessage({ sender, text });

  return { service, calls, logs, guardianCalls, incoming };
};

describe('assistant service scoping', () => {
  it('builds the portal identity from the verified student only', () => {
    assert.deepEqual(buildPortalUser(STUDENT), {
      role: 'student',
      referenceId: STUDENT.id,
      referenceModel: 'Student',
    });
  });

  it('passes only the verified student id to each portal service', async () => {
    const { calls, incoming } = createDeps();

    await incoming('hello');
    await incoming('1');
    await incoming('2');
    await incoming('3');

    assert.equal(calls.fee.length, 1);
    assert.deepEqual(calls.fee[0], buildPortalUser(STUDENT));

    assert.equal(calls.attendance.length, 1);
    assert.deepEqual(calls.attendance[0].user, buildPortalUser(STUDENT));
    assert.deepEqual(calls.attendance[0].context, {});
    assert.deepEqual(calls.attendance[0].filters, {});

    assert.equal(calls.exam.length, 1);
    assert.deepEqual(calls.exam[0].user, buildPortalUser(STUDENT));
    assert.deepEqual(calls.exam[0].context, {});
    assert.deepEqual(calls.exam[0].params, {});

    const serializedCalls = JSON.stringify(calls);
    assert.ok(!serializedCalls.includes(OTHER_STUDENT_ID));
    assert.ok(!serializedCalls.includes('922222222222'));
  });

  it('sends every reply to the verified sender with the stored token', async () => {
    const { calls, incoming } = createDeps();

    await incoming('hello', '+92 300 1234567');
    await incoming('1');

    assert.equal(calls.client.length, 2);
    for (const message of calls.client) {
      assert.equal(message.to, SENDER);
      assert.equal(message.token, 'stored-provider-token');
      assert.equal(typeof message.text, 'string');
      assert.ok(message.text.length > 0);
    }
    assert.equal(calls.tokenReads, 2);
  });

  it('passes a null token through to the client fallback without logging it', async () => {
    const { calls, logs, incoming } = createDeps({ getToken: async () => null });

    await incoming('hello');

    assert.equal(calls.client.length, 1);
    assert.equal(calls.client[0].token, null);
    assert.deepEqual(logs, []);
  });

  it('treats an unavailable portal module as "not available yet"', async () => {
    const { calls, incoming } = createDeps({ feeService: {} });

    await incoming('hello');
    const result = await incoming('1');

    assert.equal(result.action, 'menu_fees');
    assert.equal(result.replySent, true);
    assert.match(calls.client[1].text, /not available yet/i);
  });

  it('does not throw or leak details when the provider call fails', async () => {
    const { logs, incoming } = createDeps({ clientError: true });

    await incoming('hello');
    const result = await incoming('1');

    assert.equal(result.action, 'menu_fees');
    assert.equal(result.replySent, false);

    // Both the greeting and the fee reply failed, but every log line is the
    // same fixed message.
    assert.ok(logs.length > 0);
    assert.ok(logs.every((entry) => entry === 'WhatsApp reply delivery failed.'));
    assert.ok(!JSON.stringify(logs).includes(SENDER));
    assert.ok(!JSON.stringify(logs).includes('Ali'));
    assert.ok(!JSON.stringify(logs).includes('stored-provider-token'));
  });
});
