// OULAD marks missing values with an empty field or "?", so both mean "no value".

/** @param {string | undefined} value @returns {string | null} */
export function parseOptionalText(value) {
  const text = value?.trim();
  return text === undefined || text === '' || text === '?' ? null : text;
}

/** @param {string | undefined} value @param {string} field @returns {string} */
export function parseRequiredText(value, field) {
  const text = parseOptionalText(value);
  if (text === null) throw new Error(`Missing value for "${field}"`);
  return text;
}

/** @param {string | undefined} value @returns {number | null} */
export function parseOptionalNumber(value) {
  const text = parseOptionalText(value);
  if (text === null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** @param {string | undefined} value @param {string} field @returns {number} */
export function parseRequiredNumber(value, field) {
  const number = parseOptionalNumber(value);
  if (number === null) throw new Error(`Missing or invalid number for "${field}"`);
  return number;
}

/**
 * @template {string} T
 * @param {string | undefined} value @param {readonly T[]} allowed @param {string} field @returns {T}
 */
export function parseEnum(value, allowed, field) {
  const text = parseRequiredText(value, field);
  const match = allowed.find((candidate) => candidate === text);
  if (match === undefined) throw new Error(`Unexpected value "${text}" for "${field}"`);
  return match;
}

/** @param {string | undefined} value @returns {boolean} */
export function parseFlag(value) {
  return value?.trim() === '1';
}
