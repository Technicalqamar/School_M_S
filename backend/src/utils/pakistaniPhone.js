// Shared Pakistani mobile-number helpers for student guardian contact fields.
//
// The stored format is deliberately permissive because the existing student
// records already contain local ("0300-1234567") and international
// ("+92 300 1234567") spellings. Incoming WhatsApp numbers are normalized to
// the canonical provider form (`92` + 10 national digits) before matching, so
// the same person is recognized regardless of how the number was entered.

// Accepts the common local and international spellings, with an optional
// separator after the country/trunk prefix and in the middle of the number.
// Examples: 03001234567, 0300-1234567, +92 300 1234567, 0092-300-1234567,
// 923001234567, 3001234567.
const PAK_MOBILE_REGEX =
  /^(?:(?:\+92|0092|92)[-\s]?|0[-\s]?)?3\d{2}[-\s]?\d{7}$/;

/**
 * Normalize a Pakistani mobile number to the canonical WhatsApp form:
 * `92` followed by the 10 national digits.
 *
 * Returns an empty string for anything that is not a valid Pakistani mobile
 * number. The input is not coerced from a number because a leading zero would
 * already have been lost.
 */
const normalizePakistaniMobile = (value) => {
  if (typeof value !== 'string') return '';

  const text = value.trim();
  if (!text || !PAK_MOBILE_REGEX.test(text)) return '';

  let digits = text.replace(/\D/g, '');

  if (digits.startsWith('0092')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('92')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^3\d{9}$/.test(digits)) return '';

  return `92${digits}`;
};

export { PAK_MOBILE_REGEX, normalizePakistaniMobile };
export default { PAK_MOBILE_REGEX, normalizePakistaniMobile };
