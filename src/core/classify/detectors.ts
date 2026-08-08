const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REACT_ID_RE = /^:[rR][0-9a-z]*:$/;
const HEX_TOKEN_RE = /^[0-9a-f]{16,}$/i;
const RANDOM_DECIMAL_RE = /^0?\.\d{6,}$/;
const NANOID_RE = /^[A-Za-z0-9_-]{10,}$/;

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;
const LATIN_DIGITS = /[0-9]/;

/**
 * Bidirectional control characters: LRM, RLM, ALM and the isolate family.
 *
 * `Intl` wraps numbers and date fields in these when formatting for an RTL
 * locale, and *which* ones it emits differs between ICU versions — so Node and
 * the browser routinely format the same date into strings that differ only by
 * invisible marks. That is a genuine hydration mismatch whose diff is literally
 * invisible, which is exactly the case a developer cannot debug by eye.
 */
const BIDI_CONTROLS = /[‎‏؜⁦-⁩]/g;

export function stripBidiControls(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}

/** True when two values render identically once the invisible marks are gone. */
export function differsOnlyByBidiControls(a: string, b: string): boolean {
  const sa = stripBidiControls(a);
  const sb = stripBidiControls(b);
  return a !== b && sa === sb && sa.trim() !== '';
}

/**
 * Fold Arabic-Indic (٠-٩) and Extended/Persian (۰-۹) digits, plus the Arabic
 * thousands (٬) and decimal (٫) separators, onto their Latin equivalents, and
 * drop bidi controls.
 *
 * Every numeric/date/time shape test below is written in terms of `\d`, so
 * without this an app that renders Arabic-Indic digits on *both* sides gets no
 * classification at all — the script-mismatch rule only fires when the two
 * sides use different scripts. Normalisation is the identity function on Latin
 * input, so it leaves every existing LTR path byte-identical.
 */
export function normalizeNumerals(value: string): string {
  return stripBidiControls(value).replace(/[٠-٩۰-۹٫٬]/g, (ch) => {
    if (ch === '٫') return '.';
    if (ch === '٬') return ',';
    const code = ch.charCodeAt(0);
    const zero = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - zero);
  });
}

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
  return /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?\b/.test(
    normalizeNumerals(value).trim(),
  );
}

/**
 * Structural date shapes.
 *
 * `Date.parse` cannot be used as a *detector*: V8 accepts almost anything.
 * `Date.parse('100')` is the year 100, `Date.parse('server-0')` is the year
 * 2000, and `Date.parse('item 5')` is a date in May. Trusting it meant ordinary
 * text and ordinary numbers — a price, a stock count, an id like `row-3` — were
 * diagnosed as "the clock moved between server and client render", which is
 * more misleading than no diagnosis at all. So a value must look like a date
 * *by shape* before `Date.parse` is consulted at all.
 */
const ISO_DATE = /^\d{4}-\d{1,2}(?:-\d{1,2})?(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?/;
const NUMERIC_DATE = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/;
const TIME_OF_DAY = /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp]\.?[Mm]\.?)?$/;
const MONTH_NAME =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

function looksLikeDate(v: string): boolean {
  return (
    ISO_DATE.test(v) ||
    NUMERIC_DATE.test(v) ||
    TIME_OF_DAY.test(v) ||
    (MONTH_NAME.test(v) && /\d/.test(v))
  );
}

export function toTimestamp(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  // Epoch seconds/millis are unambiguous and stay matched explicitly.
  if (/^\d{10,13}$/.test(v)) {
    const n = Number(v);
    return v.length === 10 ? n * 1000 : n;
  }
  if (!looksLikeDate(v)) return null;
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

// A value made only of digits, separators and an optional sign \u2014 i.e. it
// actually looks like a formatted number. Guards against class lists, ids, and
// arbitrary text that merely contain digits (e.g. "radius-8 border p-8").
const NUMERIC_LIKE = /^[+-]?[\d.,\s\u00a0\u2009]+$/;

export function isSameNumberDifferentSeparators(a: string, b: string): boolean {
  const at = normalizeNumerals(a).trim();
  const bt = normalizeNumerals(b).trim();
  if (!NUMERIC_LIKE.test(at) || !NUMERIC_LIKE.test(bt)) return false;
  const digitsOnly = (s: string) => s.replace(/\D/g, '');
  const da = digitsOnly(at);
  const db = digitsOnly(bt);
  if (!da || da !== db) return false;
  const hasSep = (s: string) => /[.,\s\u00a0\u2009]/.test(s);
  // The "actually different" test is on the RAW values: `\u0661\u0662\u0663\u0664\u066b\u0665\u0666` and
  // `\u0661\u0662\u0663\u0664.\u0665\u0666` fold to the same string but are two different renderings of the
  // same number, which is precisely the mismatch being classified.
  return (hasSep(at) || hasSep(bt)) && a.trim() !== b.trim();
}

// Attributes whose value is human-facing content that can carry locale/date/
// random formatting. Structural attributes (class, style, id, href\u2026) are not.
const CONTENT_ATTRIBUTES = new Set<string>([
  'value',
  'placeholder',
  'title',
  'alt',
  'label',
  'aria-label',
  'aria-valuetext',
  'content',
  'datetime',
]);

export function isContentAttribute(name: string): boolean {
  return CONTENT_ATTRIBUTES.has(name.toLowerCase());
}

// Markers of third-party scripts / consent / analytics / chat widgets that
// inject nodes after the server render (not part of the app's hydration).
const THIRD_PARTY_MARKERS =
  /googlefc|adsbygoogle|google_ads|googletag|__tcfapi|onetrust|optanon|cookiebot|usercentrics|iubenda|didomi|quantcast|grammarly|data-gramm|gtm-|_hjsettings|hotjar|fullstory|intercom|drift|zendesk|livechat|tawk|hubspot|turnstile|recaptcha/i;

// True when a *node-added / node-removed* divergence is almost certainly a
// third-party injection rather than the developer's own hydration mismatch.
export function looksLikeThirdPartyNode(
  html: string | null,
  tagName: string | undefined,
): boolean {
  const tag = (tagName ?? '').toUpperCase();
  if (tag === 'IFRAME' || tag === 'EMBED' || tag === 'OBJECT') return true;
  const h = (html ?? '').toLowerCase();
  if (!h) return false;
  return THIRD_PARTY_MARKERS.test(h) || h.includes('about:blank');
}

const DATE_PARTS_RE = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/;

export function isSameDateDifferentOrder(a: string, b: string): boolean {
  const partsA = normalizeNumerals(a).trim().match(DATE_PARTS_RE);
  const partsB = normalizeNumerals(b).trim().match(DATE_PARTS_RE);
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
