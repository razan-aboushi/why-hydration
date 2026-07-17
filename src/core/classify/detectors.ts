const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REACT_ID_RE = /^:[rR][0-9a-z]*:$/;
const HEX_TOKEN_RE = /^[0-9a-f]{16,}$/i;
const RANDOM_DECIMAL_RE = /^0?\.\d{6,}$/;
const NANOID_RE = /^[A-Za-z0-9_-]{10,}$/;

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;
const LATIN_DIGITS = /[0-9]/;

export function isRandomLike(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (UUID_RE.test(v)) return true;
  if (REACT_ID_RE.test(v)) return true;
  if (HEX_TOKEN_RE.test(v)) return true;
  if (RANDOM_DECIMAL_RE.test(v)) return true;
  if (NANOID_RE.test(v) && /[A-Za-z]/.test(v) && /[0-9]/.test(v)) return true;
  return false;
}

export function looksLikeTime(value: string): boolean {
  return /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\b/.test(value.trim());
}

export function toTimestamp(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{10,13}$/.test(v)) {
    const n = Number(v);
    return v.length === 10 ? n * 1000 : n;
  }
  const parsed = Date.parse(v);
  if (!Number.isNaN(parsed)) return parsed;
  if (looksLikeTime(v)) {
    const anchored = Date.parse(`1970-01-01 ${v}`);
    if (!Number.isNaN(anchored)) return anchored;
  }
  return null;
}

export function hasArabicIndicDigits(value: string): boolean {
  return ARABIC_INDIC_DIGITS.test(value);
}

export function hasLatinDigits(value: string): boolean {
  return LATIN_DIGITS.test(value);
}

export function isSameNumberDifferentSeparators(a: string, b: string): boolean {
  const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || da !== db) return false;
  const hasSep = (s: string) => /[.,\s\u00a0\u2009]/.test(s.trim());
  return (hasSep(a) || hasSep(b)) && a.trim() !== b.trim();
}

export function isSameDateDifferentOrder(a: string, b: string): boolean {
  const partsA = a.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  const partsB = b.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  if (!partsA || !partsB) return false;
  const setA = [partsA[1], partsA[2], partsA[3]].sort().join('|');
  const setB = [partsB[1], partsB[2], partsB[3]].sort().join('|');
  return setA === setB && a.trim() !== b.trim();
}

export const EXTENSION_ATTRIBUTES = new Set<string>([
  'cz-shortcut-listen',
  'data-gramm',
  'data-gramm_editor',
  'data-gramm_id',
  'data-gr-c-s-loaded',
  'data-lt-installed',
  'data-new-gr-c-s-check-loaded',
  'data-new-gr-c-s-loaded',
  'spellcheck-extension',
  'bis_register',
  '__processed_by_react_dev_tools',
]);

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
  if ((p === 'TABLE' || p === 'THEAD' || p === 'TBODY') && c === 'DIV') {
    return true;
  }
  return false;
}

export function messageIndicatesInvalidNesting(message?: string): boolean {
  if (!message) return false;
  return (
    /validateDOMNesting/i.test(message) ||
    /cannot (?:be a|contain).*(?:descendant|child)/i.test(message) ||
    /cannot appear as a (?:child|descendant)/i.test(message)
  );
}
