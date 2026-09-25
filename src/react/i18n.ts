/**
 * Overlay languages.
 *
 * The overlay speaks the page's language where it can: an Arabic page gets an
 * Arabic, right-to-left panel, and everything else gets English. The engine's
 * own output (`cause.explanation`, the console, `onReport`) is always English;
 * only this view is translated, by looking causes up by `messageId`.
 *
 * Only the overlay imports this module, so it is tree-shaken out of production
 * builds together with the rest of the dev implementation.
 */

import type { HydrationCauseCategory } from '../core/types';
import { EN_MESSAGES, type MessageCatalog } from '../core/classify/messages';
import { AR } from './locales/ar';
import { FA } from './locales/fa';
import { HE } from './locales/he';

export type OverlayLocale = 'en' | 'ar' | 'he' | 'fa';

export interface OverlayStrings {
  readonly dir: 'ltr' | 'rtl';
  readonly title: string;
  readonly dialogLabel: string;
  readonly dismiss: string;
  readonly dismissLabel: string;
  readonly hintDismissLabel: string;
  readonly server: string;
  readonly client: string;
  readonly fix: string;
  readonly learnMore: string;
  readonly none: string;
  readonly empty: string;
  readonly fallbackCategory: string;
  readonly categories: Readonly<Record<HydrationCauseCategory, string>>;
  readonly messages: MessageCatalog;
  /** "↓ 6 issues — scroll to see all", with the language's plural rules. */
  hint(count: number): string;
}

const EN: OverlayStrings = {
  dir: 'ltr',
  title: 'Hydration mismatch',
  dialogLabel: 'Hydration mismatch diagnostics',
  dismiss: 'Dismiss',
  dismissLabel: 'Dismiss diagnostics overlay',
  hintDismissLabel: 'Dismiss hint',
  server: 'Server',
  client: 'Client',
  fix: 'Fix:',
  learnMore: 'Learn more →',
  none: '(none)',
  empty: '(empty)',
  fallbackCategory: 'Mismatch',
  categories: {
    'non-deterministic-value': 'Non-deterministic value',
    'date-time': 'Date / time',
    'locale-format': 'Locale formatting',
    'browser-only-api': 'Browser-only API',
    'viewport-branching': 'Viewport branching',
    'invalid-html-nesting': 'Invalid HTML nesting',
    'whitespace-minification': 'Whitespace / minification',
    'third-party-dom-mutation': 'Third-party DOM mutation',
    'attribute-mismatch': 'Attribute mismatch',
    unknown: 'Unknown',
  },
  messages: EN_MESSAGES,
  hint: (count) => `↓ ${count} issues — scroll to see all`,
};

export const OVERLAY_STRINGS: Readonly<Record<OverlayLocale, OverlayStrings>> =
  {
    en: EN,
    ar: AR,
    he: HE,
    fa: FA,
  };

// BCP 47 primary subtags per overlay language. Arabic lists the macrolanguage
// plus the regional varieties a site might declare instead; `iw` is the
// pre-1989 code for Hebrew that some systems still emit; Persian includes
// Dari (`prs`) and the Iranian Persian code (`pes`).
const LANG_CODES: ReadonlyArray<readonly [OverlayLocale, RegExp]> = [
  ['ar', /^(?:ar|arb|arz|ary|arq|aeb|apc|ajp|acm|afb|ars|acw|ayl|apd)(?:-|$)/i],
  ['he', /^(?:he|iw)(?:-|$)/i],
  ['fa', /^(?:fa|pes|prs)(?:-|$)/i],
];

const SUPPORTED = new Set<string>(['en', 'ar', 'he', 'fa']);

/**
 * `'auto'` (the default) follows the page's `<html lang>`: Arabic, Hebrew and
 * Persian pages get the overlay in that language, laid out right-to-left, and
 * everything else — including other right-to-left languages the overlay does
 * not translate, such as Urdu — gets English. An explicit locale wins, and
 * anything unrecognised falls back to English rather than guessing.
 */
export function resolveLocale(preference?: string): OverlayLocale {
  if (preference != null && preference !== 'auto') {
    return SUPPORTED.has(preference) ? (preference as OverlayLocale) : 'en';
  }
  if (typeof document === 'undefined') return 'en';
  const lang = (document.documentElement.getAttribute('lang') ?? '').trim();
  for (const [locale, codes] of LANG_CODES) if (codes.test(lang)) return locale;
  return 'en';
}
