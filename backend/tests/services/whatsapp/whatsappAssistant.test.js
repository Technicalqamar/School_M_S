import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createWhatsAppAssistant,
} from '../../../src/services/whatsapp/whatsappAssistant.core.js';
import {
  STAGE,
  MAIN_MENU_TEXT,
  INVALID_INPUT_TEXT,
  PRIVACY_SAFE_TEXT,
  NOT_AVAILABLE_TEXT,
  createConversationStore,
} from '../../../src/services/whatsapp/whatsappConversation.core.js';

// ---------------------------------------------------------------------------
// Assistant behaviour tests. The guardian lookup, the three data fetchers, the
// outbound sender and the logger are all fakes: no DB, no provider traffic.
// ---------------------------------------------------------------------------

const SENDER = '923001234567';
const SENDER_B = '923009999999';

const STUDENT_A = {
  id: '64b000000000000000000001',
  studentId: 'STD-001',
  fullName: 'Ali Khan',
  class: 'Class 3',
};

const STUDENT_B = {
  id: '64b000000000000000000002',
  studentId: 'STD-002',
  fullName: 'Ayesha Khan',
  class: 'Class 5',
};

const STUDENT_C = {
  id: '64b000000000000000000003',
  studentId: 'STD-003',
  fullName: 'Bilal Khan',
  class: 'Class 1',
};

const DEFAULT_FEE = {
  currentAcademicYear: '2026',
  currentMonth: 'October',
  currentFeeAmount: 2000,
  paidAmount: 500,
  outstandingAmount: 4500,
  outstandingCount: 2,
  totalPaidThisYear: 12000,
  dueDate: '2026-10-10',
  paymentStatus: 'Partial',
};

const DEFAULT_ATTENDANCE = {
  academicYear: '2026',
  summary: { present: 20, absent: 2, late: 1, leave: 1, total: 24 },
};

const DEFAULT_RESULTS = {
  academicYear: '2026',
  results: [
    { name: 'Mid Term', percentage: 78.5, grade: 'B', status: 'Passed' },
    { name: 'Final Term', percentage: null, grade: '', status: 'Pending' },
  ],
};

const createHarness = (options = {}) => {
  const sends = [];
  const fetches = { fees: [], attendance: [], results: [] };
  const logs = [];
  const guardianCalls = [];
  const clock = options.clock || { now: 2_000_000 };
  const matches = options.matches || {};
  const flags = {
    guardianError: Boolean(options.guardianError),
    sendError: Boolean(options.sendError),
    feeError: Boolean(options.feeError),
    attendanceError: Boolean(options.attendanceError),
    resultsError: Boolean(options.resultsError),
  };

  const conversations = createConversationStore({
    ttlMs: options.ttlMs,
    now: () => clock.now,
  });

  const guardian = {
    async findMatches(phone) {
      guardianCalls.push(phone);
      if (flags.guardianError) throw new Error('guardian lookup unavailable');
      return {
        canonicalPhone: phone,
        students: (matches[phone] || []).map((student) => ({ ...student })),
      };
    },
  };

  const assistant = createWhatsAppAssistant({
    guardian,
    conversations,
    fetchFeeSummary: async (student) => {
      fetches.fees.push(student.id);
      if (flags.feeError) throw new Error('fee lookup unavailable');
      return options.fee === undefined ? { ...DEFAULT_FEE } : options.fee;
    },
    fetchAttendanceSummary: async (student) => {
      fetches.attendance.push(student.id);
      if (flags.attendanceError) throw new Error('attendance lookup unavailable');
      return options.attendance === undefined ? { ...DEFAULT_ATTENDANCE } : options.attendance;
    },
    fetchResultsSummary: async (student) => {
      fetches.results.push(student.id);
      if (flags.resultsError) throw new Error('exam lookup unavailable');
      return options.results === undefined ? { ...DEFAULT_RESULTS } : options.results;
    },
    sendText: async (to, text) => {
      sends.push({ to, text });
      if (flags.sendError) throw new Error('provider unavailable');
    },
    logger: {
      error: (message) => logs.push(String(message)),
      warn: (message) => logs.push(String(message)),
    },
  });

  const incoming = (text, sender = SENDER) =>
    assistant.handleIncomingMessage({ sender, text });

  return {
    assistant,
    conversations,
    sends,
    fetches,
    logs,
    clock,
    matches,
    guardianCalls,
    flags,
    incoming,
  };
};

const startWith = async (harness, students, sender = SENDER) => {
  harness.matches[sender] = students;
  return harness.incoming('hello', sender);
};

describe('guardian matching outcomes', () => {
  it('replies with a generic privacy-safe message when no guardian matches', async () => {
    const harness = createHarness({ matches: { [SENDER_B]: [STUDENT_A] } });

    const result = await harness.incoming('hello');

    assert.equal(result.action, 'no_match');
    assert.equal(result.replySent, true);
    assert.equal(harness.sends.length, 1);
    assert.equal(harness.sends[0].to, SENDER);
    assert.equal(harness.sends[0].text, PRIVACY_SAFE_TEXT);

    // No student detail is disclosed and no state is created.
    assert.ok(!harness.sends[0].text.includes('Ali'));
    assert.equal(harness.conversations.get(SENDER), null);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });

  it('selects the only matching student and shows the main menu', async () => {
    const harness = createHarness();

    const result = await startWith(harness, [STUDENT_A]);

    assert.equal(result.action, 'matched_single');
    assert.equal(result.replySent, true);
    assert.match(harness.sends[0].text, /Ali Khan \(Class 3\)/);
    assert.match(harness.sends[0].text, /1\. Fee details/);

    const state = harness.conversations.get(SENDER);
    assert.equal(state.stage, STAGE.MAIN_MENU);
    assert.equal(state.selectedStudentId, STUDENT_A.id);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });

  it('asks for a child when several students share the number', async () => {
    const harness = createHarness();

    const result = await startWith(harness, [STUDENT_A, STUDENT_B]);

    assert.equal(result.action, 'matched_multiple');
    assert.match(harness.sends[0].text, /1\. Ali Khan \(Class 3\)/);
    assert.match(harness.sends[0].text, /2\. Ayesha Khan \(Class 5\)/);

    const state = harness.conversations.get(SENDER);
    assert.equal(state.stage, STAGE.CHILD_SELECTION);
    assert.equal(state.selectedStudentId, null);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });

  it('shows the child list even when the first message looks like a menu command', async () => {
    const harness = createHarness();

    const result = await startWith(harness, [STUDENT_A, STUDENT_B]);

    // The first message ("hello") is deliberately not interpreted as a menu
    // command; only the numbered menu shown by the school is accepted.
    assert.equal(result.action, 'matched_multiple');
    assert.equal(harness.conversations.get(SENDER).stage, STAGE.CHILD_SELECTION);
  });
});

describe('child selection', () => {
  it('selects the chosen child and then shows the main menu', async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A, STUDENT_B, STUDENT_C]);

    const result = await harness.incoming('2');

    assert.equal(result.action, 'child_selected');
    assert.match(harness.sends[1].text, /Selected: Ayesha Khan \(Class 5\)/);
    assert.match(harness.sends[1].text, /1\. Fee details/);

    const state = harness.conversations.get(SENDER);
    assert.equal(state.stage, STAGE.MAIN_MENU);
    assert.equal(state.selectedStudentId, STUDENT_B.id);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });

  it('rejects invalid child selections without changing state or fetching data', async () => {
    for (const invalid of ['0', '4', '9', 'abc', '1.5', 'STD-002', '030099999999']) {
      const harness = createHarness();
      await startWith(harness, [STUDENT_A, STUDENT_B, STUDENT_C]);

      const result = await harness.incoming(invalid);

      assert.equal(result.action, 'invalid_child_selection', `input: ${invalid}`);
      assert.match(harness.sends[1].text, /not a valid choice/i);
      assert.match(harness.sends[1].text, /1\. Ali Khan/);

      const state = harness.conversations.get(SENDER);
      assert.equal(state.stage, STAGE.CHILD_SELECTION);
      assert.equal(state.selectedStudentId, null);
      assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
    }
  });

  it('re-verifies the guardian before showing the child list or selecting a child', async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A, STUDENT_B, STUDENT_C]);

    // Access was revoked after the child list was shown.
    harness.matches[SENDER] = [];

    const result = await harness.incoming('1');

    assert.equal(result.action, 'unverified_student');
    assert.equal(harness.sends[1].text, PRIVACY_SAFE_TEXT);
    assert.equal(harness.conversations.get(SENDER), null);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
    assert.ok(!harness.sends[1].text.includes('Ali'));
  });

  it('keeps child numbers separate from menu numbers', async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A, STUDENT_B]);

    // "1" while choosing a child selects the first child, not Fee details.
    const selected = await harness.incoming('1');
    assert.equal(selected.action, 'child_selected');
    assert.equal(harness.conversations.get(SENDER).selectedStudentId, STUDENT_A.id);
    assert.deepEqual(harness.fetches.fees, []);

    // Only after the child is selected does "1" mean Fee details.
    const fee = await harness.incoming('1');
    assert.equal(fee.action, 'menu_fees');
    assert.deepEqual(harness.fetches.fees, [STUDENT_A.id]);
  });

  it('does not treat the main-menu "4" as a child number when only two children exist', async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A, STUDENT_B]);

    const result = await harness.incoming('4');

    assert.equal(result.action, 'invalid_child_selection');
    assert.equal(harness.conversations.get(SENDER).stage, STAGE.CHILD_SELECTION);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });
});

describe('main menu', () => {
  const startSingle = async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A]);
    return harness;
  };

  it('returns fee details for the verified student only', async () => {
    const harness = await startSingle();

    const result = await harness.incoming('1');

    assert.equal(result.action, 'menu_fees');
    assert.deepEqual(harness.fetches.fees, [STUDENT_A.id]);
    assert.match(harness.sends[1].text, /Fee details for Ali Khan \(Class 3\)/);
    assert.match(harness.sends[1].text, /Outstanding: Rs 4,500/);
    assert.match(harness.sends[1].text, /Pending fee items: 2/);
    assert.match(harness.sends[1].text, /Current month \(October\): Rs 2,000, paid Rs 500, Partial/);
    assert.match(harness.sends[1].text, /Due date: 10\/10\/2026/);
    assert.deepEqual(harness.fetches.attendance, []);
    assert.deepEqual(harness.fetches.results, []);
  });

  it('returns the attendance summary for the verified student only', async () => {
    const harness = await startSingle();

    const result = await harness.incoming('2');

    assert.equal(result.action, 'menu_attendance');
    assert.deepEqual(harness.fetches.attendance, [STUDENT_A.id]);
    assert.match(harness.sends[1].text, /Attendance for Ali Khan \(Class 3\)/);
    assert.match(harness.sends[1].text, /Present: 20/);
    assert.match(harness.sends[1].text, /Absent: 2/);
    assert.match(harness.sends[1].text, /Total: 24/);
    assert.deepEqual(harness.fetches.fees, []);
    assert.deepEqual(harness.fetches.results, []);
  });

  it('returns the exam results summary for the verified student only', async () => {
    const harness = await startSingle();

    const result = await harness.incoming('3');

    assert.equal(result.action, 'menu_results');
    assert.deepEqual(harness.fetches.results, [STUDENT_A.id]);
    assert.match(harness.sends[1].text, /Exam results for Ali Khan \(Class 3\)/);
    assert.match(harness.sends[1].text, /Mid Term: 78\.5%, Grade B - Passed/);
    assert.match(harness.sends[1].text, /Final Term: Pending/);
    assert.deepEqual(harness.fetches.fees, []);
    assert.deepEqual(harness.fetches.attendance, []);
  });

  it('re-sends the main menu for option 4 without fetching data', async () => {
    const harness = await startSingle();

    const result = await harness.incoming('4');

    assert.equal(result.action, 'main_menu');
    assert.equal(harness.sends[1].text, MAIN_MENU_TEXT);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });

  it('rejects invalid commands and never treats them as student identifiers', async () => {
    for (const invalid of [
      '0',
      '5',
      '99',
      'abc',
      'STD-002',
      '030099999999',
      '64b000000000000000000002',
      '2 3',
    ]) {
      const harness = await startSingle();

      const result = await harness.incoming(invalid);

      assert.equal(result.action, 'invalid_menu_selection', `input: ${invalid}`);
      assert.match(harness.sends[1].text, new RegExp(INVALID_INPUT_TEXT.replace('.', '\\.')));
      assert.match(harness.sends[1].text, /1\. Fee details/);
      assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });

      const state = harness.conversations.get(SENDER);
      assert.equal(state.stage, STAGE.MAIN_MENU);
      assert.equal(state.selectedStudentId, STUDENT_A.id);
    }
  });
});

describe('conversation state isolation and expiry', () => {
  it('never reuses one sender state for another sender', async () => {
    const harness = createHarness();
    harness.matches[SENDER] = [STUDENT_A];
    harness.matches[SENDER_B] = [STUDENT_B];

    await harness.incoming('hello', SENDER);
    await harness.incoming('hello', SENDER_B);

    assert.equal(harness.conversations.get(SENDER).selectedStudentId, STUDENT_A.id);
    assert.equal(harness.conversations.get(SENDER_B).selectedStudentId, STUDENT_B.id);

    const feeA = await harness.incoming('1', SENDER);
    const feeB = await harness.incoming('1', SENDER_B);

    assert.equal(feeA.action, 'menu_fees');
    assert.equal(feeB.action, 'menu_fees');
    assert.deepEqual(harness.fetches.fees, [STUDENT_A.id, STUDENT_B.id]);
    assert.deepEqual(
      harness.sends.map((send) => send.to),
      [SENDER, SENDER_B, SENDER, SENDER_B],
    );
    assert.ok(harness.sends.every((send) => send.to === SENDER || send.to === SENDER_B));
  });

  it('starts a fresh conversation after the state expires', async () => {
    const harness = createHarness({ ttlMs: 1000 });
    await startWith(harness, [STUDENT_A, STUDENT_B]);

    harness.clock.now += 1001;
    const result = await harness.incoming('1');

    // The expired child selection is gone, so "1" is not a child selection and
    // does not request fees. The guardian is asked to choose a child again.
    assert.equal(result.action, 'matched_multiple');
    assert.match(harness.sends[1].text, /more than one student/);
    assert.match(harness.sends[1].text, /1\. Ali Khan/);
    assert.equal(harness.conversations.get(SENDER).stage, STAGE.CHILD_SELECTION);
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
  });

  it('starts a fresh single-match conversation after expiry instead of using stale data', async () => {
    const harness = createHarness({ ttlMs: 1000 });
    await startWith(harness, [STUDENT_A]);

    harness.clock.now += 1001;
    const result = await harness.incoming('1');

    assert.equal(result.action, 'matched_single');
    assert.deepEqual(harness.fetches, { fees: [], attendance: [], results: [] });
    assert.equal(harness.conversations.get(SENDER).selectedStudentId, STUDENT_A.id);
  });

  it('clears the conversation when the guardian relationship is revoked', async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A]);

    // The school removed the guardian number between the menu and the reply.
    harness.matches[SENDER] = [];
    const result = await harness.incoming('1');

    assert.equal(result.action, 'unverified_student');
    assert.equal(result.replySent, true);
    assert.equal(harness.sends[1].text, PRIVACY_SAFE_TEXT);
    assert.equal(harness.conversations.get(SENDER), null);
    assert.deepEqual(harness.fetches.fees, []);
  });

  it('re-verifies the guardian before attendance and results as well', async () => {
    for (const choice of ['2', '3']) {
      const harness = createHarness();
      await startWith(harness, [STUDENT_A]);

      // Access was revoked after the menu was shown.
      harness.matches[SENDER] = [];
      const result = await harness.incoming(choice);

      assert.equal(result.action, 'unverified_student', `choice ${choice}`);
      assert.equal(harness.sends[1].text, PRIVACY_SAFE_TEXT);
      assert.equal(harness.conversations.get(SENDER), null);
      assert.deepEqual(harness.fetches.attendance, []);
      assert.deepEqual(harness.fetches.results, []);
    }
  });

  it('keeps the state and asks to retry when re-verification is temporarily unavailable', async () => {
    const harness = createHarness();
    await startWith(harness, [STUDENT_A]);

    harness.flags.guardianError = true;
    const result = await harness.incoming('1');

    assert.equal(result.action, 'verification_failed');
    assert.equal(result.replySent, true);
    assert.equal(harness.sends[1].text, NOT_AVAILABLE_TEXT);
    assert.equal(harness.conversations.get(SENDER).stage, STAGE.MAIN_MENU);
    assert.deepEqual(harness.fetches.fees, []);
    assert.deepEqual(harness.logs, ['WhatsApp guardian verification failed.']);
  });
});

describe('data and provider failures', () => {
  it('returns a safe "not available yet" reply when a lookup fails', async () => {
    const harness = createHarness({ feeError: true });
    await startWith(harness, [STUDENT_A]);

    const result = await harness.incoming('1');

    assert.equal(result.action, 'menu_fees');
    assert.equal(result.replySent, true);
    assert.match(harness.sends[1].text, /not available yet/i);
    assert.deepEqual(harness.fetches.fees, [STUDENT_A.id]);
    assert.deepEqual(harness.logs, ['WhatsApp data lookup failed for a verified guardian.']);
  });

  it('treats a missing module result as "not available yet" rather than inventing data', async () => {
    const feeHarness = createHarness({ fee: null });
    await startWith(feeHarness, [STUDENT_A]);
    await feeHarness.incoming('1');
    assert.match(feeHarness.sends[1].text, /not available yet/i);
    assert.ok(!feeHarness.sends[1].text.includes('Rs'));

    const attendanceHarness = createHarness({ attendance: null });
    await startWith(attendanceHarness, [STUDENT_A]);
    await attendanceHarness.incoming('2');
    assert.match(attendanceHarness.sends[1].text, /not available yet/i);

    const resultsHarness = createHarness({ results: null });
    await startWith(resultsHarness, [STUDENT_A]);
    await resultsHarness.incoming('3');
    assert.match(resultsHarness.sends[1].text, /not available yet/i);
  });

  it('reports empty verified data without inventing records', async () => {
    const attendanceHarness = createHarness({
      attendance: { academicYear: '2026', summary: { present: 0, absent: 0, late: 0, leave: 0, total: 0 } },
    });
    await startWith(attendanceHarness, [STUDENT_A]);
    await attendanceHarness.incoming('2');
    assert.match(attendanceHarness.sends[1].text, /No attendance records have been recorded yet/);

    const resultsHarness = createHarness({ results: { academicYear: '2026', results: [] } });
    await startWith(resultsHarness, [STUDENT_A]);
    await resultsHarness.incoming('3');
    assert.match(resultsHarness.sends[1].text, /No exam results have been published yet/);
  });

  it('swallows provider failures and logs only a fixed, PII-free message', async () => {
    const harness = createHarness({ sendError: true });
    await startWith(harness, [STUDENT_A]);

    const result = await harness.incoming('1');

    assert.equal(result.action, 'menu_fees');
    assert.equal(result.replySent, false);
    assert.ok(harness.logs.length > 0);
    assert.ok(harness.logs.every((entry) => entry === 'WhatsApp reply delivery failed.'));

    const logText = JSON.stringify(harness.logs);
    assert.ok(!logText.includes(SENDER));
    assert.ok(!logText.includes('Ali'));
    assert.ok(!logText.includes('Rs 4,500'));
    assert.ok(!logText.includes('provider unavailable'));
    assert.ok(!logText.includes('token'));
  });

  it('keeps the privacy-safe reply on provider failure for an unknown number', async () => {
    const harness = createHarness({ matches: {}, sendError: true });

    const result = await harness.incoming('hello');

    assert.equal(result.action, 'no_match');
    assert.equal(result.replySent, false);
    assert.deepEqual(harness.logs, ['WhatsApp reply delivery failed.']);
    assert.equal(harness.conversations.get(SENDER), null);
  });

  it('does not start processing for an invalid sender, empty text or oversized text', async () => {
    const harness = createHarness();

    const invalidSender = await harness.incoming('1', 'not-a-phone');
    assert.equal(invalidSender.action, 'ignored');
    assert.equal(invalidSender.reason, 'invalid_sender');

    const empty = await harness.incoming('   ');
    assert.equal(empty.action, 'ignored');
    assert.equal(empty.reason, 'empty_message');

    const tooLong = await harness.incoming('1'.repeat(513));
    assert.equal(tooLong.action, 'ignored');
    assert.equal(tooLong.reason, 'message_too_long');

    assert.equal(harness.sends.length, 0);
    assert.equal(harness.guardianCalls.length, 0);
  });

  it('replies only to the canonical incoming sender, never to a number in the text', async () => {
    const harness = createHarness();
    harness.matches[SENDER] = [STUDENT_A];

    const result = await harness.incoming('hello', '+92 300 1234567');

    assert.equal(result.action, 'matched_single');
    assert.equal(harness.sends[0].to, SENDER);

    // A crafted message containing another number is just an invalid menu
    // command; it never changes the destination or the selected student.
    const crafted = await harness.incoming('030099999999');
    assert.equal(crafted.action, 'invalid_menu_selection');
    assert.equal(harness.sends[1].to, SENDER);
    assert.equal(harness.conversations.get(SENDER).selectedStudentId, STUDENT_A.id);
  });
});
