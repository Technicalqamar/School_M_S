// Pure helpers for persisting/loading the ID Card designer layout.
//
// The designer edits ONE layout (`frontConfig` / `backConfig` + a `template`)
// that is applied to every printed card, while the backend stores the design on
// each student card (`IdCardManagement.frontDesign` / `backDesign` / `template`).
// These helpers bridge the two and are deliberately framework-free so the
// payload shape, the "which cards does this design apply to" decision and the
// read-back logic can all be unit-tested under the project's `node --test`
// setup.
//
// Both ID-card surfaces use the SAME read-back rule so they can never drift:
//   - the bulk designer (QRCodeManagement) -> extractSavedDesign(students)
//   - the single-student page (StudentIdCard) -> resolveIdCardDesign(card)

const VALID_TEMPLATES = ['vertical', 'horizontal'];

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Builds the request body accepted by `validateUpdateDesign` /
// `idCardManagement.service.updateCardDesign`. Only the keys actually provided
// are sent so a partial save cannot wipe the other design side.
export const buildDesignPayload = ({ template, frontConfig, backConfig } = {}) => {
  const payload = {};
  if (template) payload.template = template;
  if (isPlainObject(frontConfig)) payload.frontDesign = frontConfig;
  if (isPlainObject(backConfig)) payload.backDesign = backConfig;
  return payload;
};

// Reads the saved design off a single serialized card.
//
// A saved design is signalled by `frontDesign` / `backDesign` — NOT by
// `template`, because every generated card already defaults to
// `template: 'vertical'`, so the template alone cannot distinguish a card the
// admin designed from one that was merely generated. A malformed side (a
// string/array/null) is treated as absent, and a card with neither valid side
// yields `null` so the caller can fall back to the default template. An invalid
// or missing template falls back to `'vertical'`.
export const designFromCard = (card) => {
  if (!isPlainObject(card)) return null;
  const frontDesign = isPlainObject(card.frontDesign) ? card.frontDesign : null;
  const backDesign = isPlainObject(card.backDesign) ? card.backDesign : null;
  if (!frontDesign && !backDesign) return null;
  return {
    template: VALID_TEMPLATES.includes(card.template) ? card.template : 'vertical',
    frontDesign,
    backDesign,
  };
};

// Reads the saved design off the loaded student cards. The designer is global,
// so the first card that actually carries a saved design is authoritative; a
// card that only has a QR value (no design) is skipped instead of resetting the
// designer to defaults.
export const extractSavedDesign = (students = []) => {
  if (!Array.isArray(students)) return null;
  for (const student of students) {
    const design = designFromCard(student?.card);
    if (design) return design;
  }
  return null;
};

// Resolves the exact configs the single-student page feeds to the shared
// template renderer (preview `layoutConfig` and `toHtml(frontConfig, backConfig)`).
// Whenever no valid saved design exists it returns the default (empty) configs
// and the `'vertical'` template, preserving the pre-persistence behaviour.
export const resolveIdCardDesign = (card) => {
  const design = designFromCard(card);
  if (!design) {
    return { hasSavedDesign: false, template: 'vertical', frontConfig: {}, backConfig: {} };
  }
  return {
    hasSavedDesign: true,
    template: design.template,
    frontConfig: design.frontDesign || {},
    backConfig: design.backDesign || {},
  };
};

// The cards the current designer layout applies to: the explicit selection when
// the user made one, otherwise every card currently in view. Teacher cards are
// never returned because the id-card API (and its design fields) only exist for
// students, so sending teacher ids would 400/fail.
export const resolveDesignTargets = ({ selectedIds, students } = {}) => {
  const list = Array.isArray(students) ? students : [];
  const selected =
    selectedIds instanceof Set
      ? selectedIds
      : new Set(Array.isArray(selectedIds) ? selectedIds : []);

  const source = selected.size
    ? list.filter((s) => selected.has(s?.id) || selected.has(s?._id))
    : list;

  return source
    .filter((s) => (s?.personType || 'Student') !== 'Teacher')
    .map((s) => s?.id || s?._id)
    .filter(Boolean);
};
