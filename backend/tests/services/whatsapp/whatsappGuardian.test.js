import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizePakistaniPhone,
  buildGuardianPhoneRegex,
  resolveMatchOutcome,
  toStudentSummary,
} from '../../../src/services/whatsapp/whatsappGuardian.core.js';
import { createGuardianService } from '../../../src/services/whatsapp/whatsappGuardian.service.js';

// ---------------------------------------------------------------------------
// Guardian matching tests. Everything is pure or uses a fake model, so no
// database connection and no student record is touched.
// ---------------------------------------------------------------------------

const CANONICAL = '923001234567';

const createFakeModel = (documents) => {
  const calls = { find: [], select: [] };

  const chain = {
    select(fields) {
      calls.select.push(fields);
      return chain;
    },
    async lean() {
      return documents;
    },
  };

  return {
    calls,
    find(query) {
      calls.find.push(query);
      return chain;
    },
  };
};

describe('Pakistani phone normalization', () => {
  it('normalizes every common local and international spelling', () => {
    const inputs = [
      '+92 300 1234567',
      '+92-300-1234567',
      '0092 300 1234567',
      '0092-300-1234567',
      '923001234567',
      '+923001234567',
      '0300-1234567',
      '0300 1234567',
      '03001234567',
      '3001234567',
      '923001234567@s.whatsapp.net',
      '923001234567:12@s.whatsapp.net',
      923001234567,
    ];

    for (const input of inputs) {
      assert.equal(normalizePakistaniPhone(input), CANONICAL, `failed for ${String(input)}`);
    }
  });

  it('rejects values that are not Pakistani mobile numbers', () => {
    const inputs = [
      '',
      '   ',
      null,
      undefined,
      'abc',
      '12345',
      '042-37654321', // landline
      '04237654321',
      '+1 202 555 0143',
      '92300123456', // too short
      '9230012345678', // too long
      '0300123456', // too short
      '030012345678', // too long
      '923001234567abc',
      '@s.whatsapp.net',
      true,
      {},
    ];

    for (const input of inputs) {
      assert.equal(normalizePakistaniPhone(input), '', `expected rejection for ${String(input)}`);
    }
  });
});

describe('guardian query pattern', () => {
  const storedFormats = [
    '+923001234567',
    '923001234567',
    '00923001234567',
    '03001234567',
    '0300-1234567',
    '0300 1234567',
    '+92 300 1234567',
    '+92-300-1234567',
    ' 0300.1234567 ',
  ];

  it('matches the stored Pakistani formats without changing the records', () => {
    const pattern = buildGuardianPhoneRegex(CANONICAL);

    for (const stored of storedFormats) {
      assert.ok(pattern.test(stored), `expected ${stored} to match`);
    }
  });

  it('does not match a different or malformed number', () => {
    const pattern = buildGuardianPhoneRegex(CANONICAL);

    const nonMatches = [
      '03001234568',
      '0300123456',
      '030012345678',
      '04237654321',
      '9230012345678',
      '9230012345670',
      'not-a-phone',
      '',
    ];

    for (const value of nonMatches) {
      assert.equal(pattern.test(value), false, `expected ${value} not to match`);
    }
  });

  it('returns null for an unusable number', () => {
    assert.equal(buildGuardianPhoneRegex('invalid'), null);
    assert.equal(buildGuardianPhoneRegex(''), null);
    assert.equal(buildGuardianPhoneRegex(null), null);
  });
});

describe('match outcome and summaries', () => {
  it('distinguishes none, one and many matches', () => {
    assert.deepEqual(resolveMatchOutcome([]), { outcome: 'none', student: null });
    assert.deepEqual(resolveMatchOutcome(null), { outcome: 'none', student: null });

    const one = { id: 'a' };
    assert.deepEqual(resolveMatchOutcome([one]), { outcome: 'single', student: one });

    const outcome = resolveMatchOutcome([one, { id: 'b' }]);
    assert.equal(outcome.outcome, 'multiple');
    assert.equal(outcome.student, null);
  });

  it('ignores malformed candidates', () => {
    assert.equal(resolveMatchOutcome([null, {}, { id: '' }]).outcome, 'none');
  });

  it('builds a minimal student summary without phone fields', () => {
    const summary = toStudentSummary({
      _id: { toString: () => 'id-1' },
      studentId: 'STD-1',
      fullName: 'Ali Khan',
      class: 'Class 3',
      fatherPhone: '+923001234567',
      alternatePhone: '03001234567',
      whatsappNumber: '923001234567',
    });

    assert.deepEqual(summary, {
      id: 'id-1',
      studentId: 'STD-1',
      fullName: 'Ali Khan',
      class: 'Class 3',
    });
  });
});

describe('guardian service', () => {
  const doc = (overrides = {}) => ({
    _id: '64b000000000000000000001',
    studentId: 'STD-001',
    fullName: 'Ali Khan',
    class: 'Class 3',
    fatherPhone: '0300-1234567',
    alternatePhone: '',
    whatsappNumber: '',
    ...overrides,
  });

  it('queries only active students and all guardian phone fields', async () => {
    const model = createFakeModel([]);
    const service = createGuardianService({ model });

    await service.findMatches('+92 300 1234567');

    assert.equal(model.calls.find.length, 1);
    const query = model.calls.find[0];
    assert.equal(query.status, 'Active');
    assert.equal(query.$or.length, 3);
    assert.ok(query.$or[0].fatherPhone instanceof RegExp);
    assert.ok(query.$or[1].alternatePhone instanceof RegExp);
    assert.ok(query.$or[2].whatsappNumber instanceof RegExp);

    // Only the fields needed for the child menu (and the three phone fields for
    // re-verification) are selected.
    assert.match(model.calls.select[0], /fullName/);
    assert.match(model.calls.select[0], /class/);
    assert.match(model.calls.select[0], /whatsappNumber/);
  });

  it('matches fatherPhone, alternatePhone, whatsappNumber and deduplicates the same student', async () => {
    const model = createFakeModel([
      doc({ _id: '1', studentId: 'S-2', fullName: 'Zara Khan', class: 'Class 5' }),
      doc({
        _id: '2',
        studentId: 'S-1',
        fullName: 'Ali Khan',
        class: 'Class 3',
        fatherPhone: '',
        alternatePhone: '+923001234567',
      }),
      doc({
        _id: '3',
        studentId: 'S-3',
        fullName: 'Bilal Ahmed',
        class: 'Class 4',
        fatherPhone: '',
        alternatePhone: '',
        whatsappNumber: '0300-1234567',
      }),
      doc({ _id: '1', studentId: 'S-2', fullName: 'Zara Khan', class: 'Class 5' }),
    ]);

    const service = createGuardianService({ model });
    const result = await service.findMatches(CANONICAL);

    assert.equal(result.canonicalPhone, CANONICAL);
    assert.deepEqual(result.students, [
      { id: '2', studentId: 'S-1', fullName: 'Ali Khan', class: 'Class 3' },
      { id: '3', studentId: 'S-3', fullName: 'Bilal Ahmed', class: 'Class 4' },
      { id: '1', studentId: 'S-2', fullName: 'Zara Khan', class: 'Class 5' },
    ]);
  });

  it('re-verifies every stored phone field in JavaScript and rejects a false query hit', async () => {
    const model = createFakeModel([
      doc({ _id: '1', fatherPhone: '0300-9999999' }), // regex over-match simulation
      doc({
        _id: '2',
        fatherPhone: '',
        alternatePhone: '',
        whatsappNumber: '0300-8888888',
      }),
    ]);

    const service = createGuardianService({ model });
    const result = await service.findMatches(CANONICAL);

    assert.deepEqual(result.students, []);
  });

  it('does not query for an unusable sender number', async () => {
    const model = createFakeModel([doc()]);
    const service = createGuardianService({ model });

    const result = await service.findMatches('not-a-phone');

    assert.deepEqual(result, { canonicalPhone: '', students: [] });
    assert.equal(model.calls.find.length, 0);
  });

  it('returns no students when the model has no matches', async () => {
    const model = createFakeModel([]);
    const service = createGuardianService({ model });

    const result = await service.findMatches(CANONICAL);

    assert.deepEqual(result.students, []);
  });

  it('never exposes guardian phone numbers in the student summaries', async () => {
    const model = createFakeModel([doc()]);
    const service = createGuardianService({ model });

    const result = await service.findMatches(CANONICAL);
    const serialized = JSON.stringify(result.students);

    assert.ok(!serialized.includes('1234567'));
    assert.deepEqual(Object.keys(result.students[0]).sort(), ['class', 'fullName', 'id', 'studentId']);
  });
});
