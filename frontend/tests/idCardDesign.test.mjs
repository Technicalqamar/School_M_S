// Tests for the ID Card designer persistence helpers.
//
// Root cause being pinned: the designer's "Save Design" button only set React
// state, so a saved layout was lost on reload even though the backend already
// persists per-student card designs (PUT /id-cards/:studentId/design and the
// frontDesign/backDesign/template fields returned by GET /id-cards/students).
// These helpers build the request body, decide which cards the layout applies
// to, and read a saved layout back off the loaded cards.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesignPayload,
  designFromCard,
  extractSavedDesign,
  resolveDesignTargets,
  resolveIdCardDesign,
} from '../src/utils/idCardDesign.js';

const FRONT = { cardWidth: 320, primaryColor: '#2563eb' };
const BACK = { cardWidth: 320, primaryColor: '#1e40af' };

test('buildDesignPayload forwards template and both design sides', () => {
  const payload = buildDesignPayload({
    template: 'horizontal',
    frontConfig: FRONT,
    backConfig: BACK,
  });

  assert.deepEqual(payload, {
    template: 'horizontal',
    frontDesign: FRONT,
    backDesign: BACK,
  });
});

test('buildDesignPayload omits missing pieces so a partial save cannot wipe them', () => {
  assert.deepEqual(buildDesignPayload({ template: 'vertical' }), { template: 'vertical' });
  assert.deepEqual(buildDesignPayload({ frontConfig: FRONT }), { frontDesign: FRONT });
  assert.deepEqual(buildDesignPayload({}), {});
  assert.deepEqual(buildDesignPayload(), {});
});

test('buildDesignPayload ignores non-object design sides', () => {
  const payload = buildDesignPayload({
    template: 'vertical',
    frontConfig: 'nope',
    backConfig: null,
  });
  assert.deepEqual(payload, { template: 'vertical' });
});

test('extractSavedDesign returns the first card that actually carries a design', () => {
  const students = [
    { id: 'a', card: { qrValue: 'QR-1', cardStatus: 'Generated', template: 'vertical', frontDesign: null, backDesign: null } },
    { id: 'b', card: { qrValue: 'QR-2', template: 'horizontal', frontDesign: FRONT, backDesign: BACK } },
  ];

  assert.deepEqual(extractSavedDesign(students), {
    template: 'horizontal',
    frontDesign: FRONT,
    backDesign: BACK,
  });
});

test('extractSavedDesign defaults the template when only a design side is saved', () => {
  const students = [{ id: 'a', card: { frontDesign: FRONT, backDesign: null } }];
  assert.deepEqual(extractSavedDesign(students), {
    template: 'vertical',
    frontDesign: FRONT,
    backDesign: null,
  });
});

test('extractSavedDesign returns null when no card has a saved design', () => {
  assert.equal(extractSavedDesign([]), null);
  assert.equal(extractSavedDesign(null), null);
  assert.equal(extractSavedDesign([{ id: 'a', card: null }]), null);
  assert.equal(
    extractSavedDesign([{ id: 'a', card: { qrValue: 'QR-1', cardStatus: 'Generated' } }]),
    null,
  );
});

test('resolveDesignTargets uses the explicit selection when one exists', () => {
  const students = [
    { id: 'a', personType: 'Student' },
    { id: 'b', personType: 'Student' },
    { id: 'c', personType: 'Student' },
  ];
  assert.deepEqual(
    resolveDesignTargets({ selectedIds: new Set(['b']), students }),
    ['b'],
  );
});

test('resolveDesignTargets falls back to every loaded card when nothing is selected', () => {
  const students = [
    { id: 'a', personType: 'Student' },
    { id: 'b', personType: 'Student' },
  ];
  assert.deepEqual(resolveDesignTargets({ selectedIds: new Set(), students }), ['a', 'b']);
});

test('resolveDesignTargets never returns teacher cards (no persistence API)', () => {
  const students = [
    { id: 'a', personType: 'Student' },
    { id: 't1', personType: 'Teacher' },
  ];
  assert.deepEqual(resolveDesignTargets({ selectedIds: new Set(), students }), ['a']);
  assert.deepEqual(resolveDesignTargets({ selectedIds: new Set(['t1', 'a']), students }), ['a']);
});

test('resolveDesignTargets accepts an array of ids and tolerates bad input', () => {
  const students = [{ _id: 'x' }, { _id: 'y' }];
  assert.deepEqual(resolveDesignTargets({ selectedIds: ['y'], students }), ['y']);
  assert.deepEqual(resolveDesignTargets(), []);
  assert.deepEqual(resolveDesignTargets({ students: null }), []);
});

// --- Task 5: single-student saved-design load + render/print config ---------

test('designFromCard loads a saved design and its template', () => {
  assert.deepEqual(
    designFromCard({ template: 'horizontal', frontDesign: FRONT, backDesign: BACK }),
    { template: 'horizontal', frontDesign: FRONT, backDesign: BACK },
  );
});

test('designFromCard skips a card that was only generated (template alone is not a design)', () => {
  // generateQRCodes always stores template 'vertical'; that must not count as a
  // saved design or the single-student page would treat every card as designed.
  assert.equal(designFromCard({ qrValue: 'QR-1', template: 'vertical' }), null);
  assert.equal(designFromCard({ qrValue: 'QR-1', cardStatus: 'Generated' }), null);
  assert.equal(designFromCard(null), null);
});

test('designFromCard keeps a partial (one-sided) design and defaults the template', () => {
  assert.deepEqual(designFromCard({ frontDesign: FRONT }), {
    template: 'vertical',
    frontDesign: FRONT,
    backDesign: null,
  });
});

test('designFromCard treats malformed/unknown values as absent', () => {
  assert.equal(designFromCard({ frontDesign: 'nope', backDesign: [] }), null);
  assert.deepEqual(designFromCard({ template: 'diagonal', frontDesign: FRONT }), {
    template: 'vertical',
    frontDesign: FRONT,
    backDesign: null,
  });
});

test('resolveIdCardDesign falls back to the default template when no design is saved', () => {
  assert.deepEqual(resolveIdCardDesign(null), {
    hasSavedDesign: false,
    template: 'vertical',
    frontConfig: {},
    backConfig: {},
  });
  assert.deepEqual(resolveIdCardDesign({ qrValue: 'QR-1', template: 'vertical' }), {
    hasSavedDesign: false,
    template: 'vertical',
    frontConfig: {},
    backConfig: {},
  });
});

test('resolveIdCardDesign returns the exact configs the renderer consumes', () => {
  // These frontConfig/backConfig objects are what StudentIdCard feeds to
  // <Template layoutConfig> for the preview and to Template.toHtml(front, back)
  // for printing, so asserting them pins the saved design into both flows.
  const resolved = resolveIdCardDesign({
    template: 'horizontal',
    frontDesign: FRONT,
    backDesign: BACK,
  });
  assert.deepEqual(resolved, {
    hasSavedDesign: true,
    template: 'horizontal',
    frontConfig: FRONT,
    backConfig: BACK,
  });
});

test('resolveIdCardDesign defaults the missing side of an incomplete design', () => {
  const resolved = resolveIdCardDesign({ template: 'horizontal', frontDesign: FRONT });
  assert.equal(resolved.hasSavedDesign, true);
  assert.equal(resolved.template, 'horizontal');
  assert.deepEqual(resolved.frontConfig, FRONT);
  assert.deepEqual(resolved.backConfig, {});
});

test('resolveIdCardDesign safely defaults an invalid design', () => {
  const resolved = resolveIdCardDesign({ template: 'nonsense', frontDesign: 42, backDesign: 'x' });
  assert.deepEqual(resolved, {
    hasSavedDesign: false,
    template: 'vertical',
    frontConfig: {},
    backConfig: {},
  });
});
