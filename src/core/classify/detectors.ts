/**
 * Low-level, pure predicates used by the classifier rules. Kept separate so
 * they can be unit-tested in isolation and reused by custom classifiers.
 */

/** UUID v1–v5 shape. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** React `useId()` output, e.g. `:r0:`, `:R1H:`. */
const REACT_ID_RE = /^:[rR][0-9a-z]*:$/;
/** A long hex token (crypto.randomBytes-style). */
const HEX_TOKEN_RE = /^[0-9a-f]{16,}$/i;
/** A high-entropy decimal fraction, the classic `Math.random()` fingerprint. */
const RANDOM_DECIMAL_RE = /^0?\.\d{6,}$/;
/** nanoid / base64url-ish token (mixed case + digits, no spaces). */
const NANOID_RE = /^[A-Za-z0-9_-]{10,}$/;

/** Arabic-Indic (٠-٩) and Extended/Persian (۰-۹) digit ranges. */
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;
const LATIN_DIGITS = /[0-9]/;

/** True when a value looks like a randomly generated id/token/number. */
export function isRandomLike(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (UUID_RE.test(v)) return true;
  if (REACT_ID_RE.test(v)) return true;
  if (HEX_TOKEN_RE.test(v)) return true;
  if (RANDOM_DECIMAL_RE.test(v)) return true;
  // nanoid-style: require some entropy (both letters and digits) to avoid
  // matching ordinary words.
  if (NANOID_RE.test(v) && /[A-Za-z]/.test(v) && /[0-9]/.test(v)) return true;
  return false;
}

/** True when the string is a clock-like time, e.g. `10:23:45 AM`, `21:03`. */
export function looksLikeTime(value: string): boolean {
  return /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\b/.test(value.trim());
}

/** Parse a value to a millisecond timestamp if it is a date/time, else null. */
export function toTimestamp(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  // Bare epoch (seconds or millis) — 10+ digits.
  if (/^\d{10,13}$/.test(v)) {
    const n = Number(v);
    return v.length === 10 ? n * 1000 : n;
  }
  const parsed = Date.parse(v);
  if (!Number.isNaN(parsed)) return parsed;
  // Time-only string: anchor to a fixed date so two times are comparable.
  if (looksLikeTime(v)) {
    const anchored = Date.parse(`1970-01-01 ${v}`);
    if (!Number.isNaN(anchored)) return anchored;
  }
  return null;
}

/** True when the value contains Arabic-Indic / Persian digits. */
export function hasArabicIndicDigits(value: string): boolean {
  return ARABIC_INDIC_DIGITS.test(value);
}

/** True when the value contains Latin (ASCII) digits. */
export function hasLatinDigits(value: string): boolean {
  return LATIN_DIGITS.test(value);
}

/**
 * True when two values are the same number formatted with different grouping /
 * decimal separators, e.g. `1,234.56` vs `1.234,56` or `1 234,56`.
 */
export function isSameNumberDifferentSeparators(a: string, b: string): boolean {
  const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || da !== db) return false;
  // Must actually contain separators (otherwise it's just equal digits).
  const hasSep = (s: string) => /[.,\s\u00a0\u2009]/.test(s.trim());
  return (hasSep(a) || hasSep(b)) && a.trim() !== b.trim();
}

/**
 * True when both values are dates written with the same numeric parts in a
 * different order (MM/DD/YYYY vs DD/MM/YYYY).
 */
export function isSameDateDifferentOrder(a: string, b: string): boolean {
  const partsA = a.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  const partsB = b.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  if (!partsA || !partsB) return false;
  const setA = [partsA[1], partsA[2], partsA[3]].sort().join('|');
  const setB = [partsB[1], partsB[2], partsB[3]].sort().join('|');
  return setA === setB && a.trim() !== b.trim();
}

/** Attribute names commonly injected by browser extensions / third parties. */
export const EXTENSION_ATTRIBUTES = new Set<string>([
  'cz-shortcut-listen', // ColorZilla
  'data-gramm', // Grammarly
  'data-gramm_editor',
  'data-gramm_id',
  'data-gr-c-s-loaded',
  'data-lt-installed', // LanguageTool
  'data-new-gr-c-s-check-loaded',
  'data-new-gr-c-s-loaded',
  'spellcheck-extension',
  'bis_register', // Bitdefender
  '__processed_by_react_dev_tools',
]);

/** True when an attribute name (or prefix) is a known extension marker. */
export function isExtensionAttribute(name: string): boolean {
  const n = name.toLowerCase();
  if (EXTENSION_ATTRIBUTES.has(n)) return true;
  return (
    n.startsWith('data-gr-') ||
    n.startsWith('data-gramm') ||
    n.startsWith('__bis') ||
    n.startsWith('bis_')
  );
}

/** Block-level elements that are invalid as descendants of `<p>`. */
const BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'SECTION',
  'ARTICLE',
  'UL',
  'OL',
  'LI',
  'TABLE',
  'HEADER',
  'FOOTER',
  'MAIN',
  'ASIDE',
  'NAV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'FORM',
  'BLOCKQUOTE',
  'PRE',
  'HR',
]);

/** True for a structurally invalid parent/child tag pairing. */
export function isInvalidNesting(
  parentTag: string | undefined,
  childTag: string | undefined,
): boolean {
  if (!parentTag || !childTag) return false;
  const p = parentTag.toUpperCase();
  const c = childTag.toUpperCase();
  if (p === 'P' && BLOCK_TAGS.has(c)) return true;
  if (p === 'A' && c === 'A') return true;
  if (p === 'BUTTON' && (c === 'BUTTON' || c === 'A')) return true;
  // Table sanity: text/blocks directly inside table structure.
  if ((p === 'TABLE' || p === 'THEAD' || p === 'TBODY') && c === 'DIV') {
    return true;
  }
  return false;
}

/** True when a React hydration message describes invalid DOM nesting. */
export function messageIndicatesInvalidNesting(message?: string): boolean {
  if (!message) return false;
  return (
    /validateDOMNesting/i.test(message) ||
    /cannot (?:be a|contain).*(?:descendant|child)/i.test(message) ||
    /cannot appear as a (?:child|descendant)/i.test(message)
  );
}
