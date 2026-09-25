import type { Cause, HydrationReport } from '../core/types';
import {
  EN_MESSAGES,
  plainText,
  renderMessage,
  type MessageId,
  type MessageSegment,
} from '../core/classify/messages';
import {
  OVERLAY_STRINGS,
  resolveLocale,
  type OverlayLocale,
  type OverlayStrings,
} from './i18n';

export type { OverlayLocale } from './i18n';

export interface OverlayOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /**
   * Language of the panel. `'auto'` (the default) follows the page's
   * `<html lang>`: an Arabic page gets an Arabic, right-to-left panel and
   * every other page gets English. Pass `'en'` or `'ar'` to pin it.
   */
  locale?: 'auto' | OverlayLocale;
}

export interface OverlayHandle {
  push: (report: HydrationReport) => void;
  destroy: () => void;
}

const CONTAINER_ID = 'why-hydration-overlay';

// Proportional faces that carry Arabic script on each platform, so Arabic text
// never falls through to a monospace face — those render it disconnected.
const ARABIC_FACES = 'Tahoma, "Noto Sans Arabic", "Geeza Pro", "Segoe UI"';
const UI_FONT = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, ${ARABIC_FACES}, sans-serif`;
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const STYLES = `
:host {
  all: initial;
  /* The "all" shorthand deliberately excludes direction/unicode-bidi (CSS
     spec), so these are set explicitly: the host page's own dir must never
     leak in. The panel below then takes its direction from the overlay's
     language, set inside this shadow root where no page style can reach it. */
  direction: ltr;
  unicode-bidi: isolate;
}
* { box-sizing: border-box; }
.wh-panel {
  position: fixed;
  z-index: 2147483647;
  width: min(420px, calc(100vw - 32px));
  max-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
  font: 13px/1.5 ${UI_FONT};
  color: #e5e7eb;
  background: #0b0f17;
  border: 1px solid #1f2937;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.5);
  overflow: hidden;
  text-align: start;
}
.wh-panel[dir="ltr"] { direction: ltr; }
/* Arabic reads poorly at Latin sizes, and letter-spacing or uppercasing breaks
   the joining between its letters, so the right-to-left panel resets both. */
.wh-panel[dir="rtl"] { direction: rtl; font-size: 14px; line-height: 1.7; }
.wh-panel[dir="rtl"] .wh-side .wh-label { text-transform: none; letter-spacing: 0; font-size: 11px; }
.wh-bottom-right { bottom: 16px; right: 16px; }
.wh-bottom-left  { bottom: 16px; left: 16px; }
.wh-top-right    { top: 16px; right: 16px; }
.wh-top-left     { top: 16px; left: 16px; }
.wh-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(180deg, #151b26, #0d1220);
  border-bottom: 1px solid #1f2937;
}
.wh-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex: none; }
.wh-title { font-weight: 600; color: #f3f4f6; }
.wh-count {
  margin-inline-start: auto; font-size: 11px; color: #9ca3af;
  background: #111827; border: 1px solid #1f2937; border-radius: 999px;
  padding: 1px 8px;
}
.wh-btn {
  appearance: none; border: 1px solid #1f2937; background: #111827;
  color: #9ca3af; border-radius: 6px; cursor: pointer;
  font: inherit; font-size: 12px; padding: 3px 8px;
}
.wh-btn:hover { color: #f3f4f6; border-color: #374151; }
.wh-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.wh-card { flex: 0 0 auto; border: 1px solid #1f2937; border-radius: 10px; background: #0f1521; overflow: hidden; }
.wh-card-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
.wh-cat { font-weight: 600; color: #fbbf24; font-size: 12px; }
.wh-conf { margin-inline-start: auto; font-size: 11px; color: #6b7280; unicode-bidi: isolate; }
.wh-body { padding: 0 10px 10px; }
.wh-where { font-size: 11px; color: #9ca3af; overflow-wrap: anywhere; margin-bottom: 4px; }
/* Selectors, component names, file paths and attribute names are code: they
   stay left-to-right and isolated, or an RTL line mirrors their brackets and
   reorders their segments. */
.wh-where code, .wh-comp, .wh-attr { unicode-bidi: isolate; font-family: ${MONO_FONT}; }
.wh-where code { color: #93c5fd; }
.wh-comp { color: #f3f4f6; font-weight: 600; }
.wh-attr { color: #c4b5fd; }
.wh-loc { font-size: 11px; color: #7dd3fc; overflow-wrap: anywhere; margin-bottom: 8px; font-family: ${MONO_FONT}; unicode-bidi: isolate; text-align: start; }
.wh-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.wh-side { border-radius: 8px; padding: 6px 8px; font-size: 11px; min-width: 0; }
.wh-server { background: rgba(244,63,94,.08); border: 1px solid rgba(244,63,94,.35); }
.wh-client { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.35); }
.wh-side .wh-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 3px; }
.wh-server .wh-label { color: #fb7185; }
.wh-client .wh-label { color: #4ade80; }
/* A value is page data in any script. Each line takes its direction from its
   own first strong character, so Arabic values read right-to-left with their
   punctuation at the end even inside the English panel, and English values
   stay left-to-right inside the Arabic one. Whitespace is preserved: a diff
   viewer that collapses spaces hides whitespace-only mismatches. */
.wh-value {
  display: block; unicode-bidi: plaintext; text-align: start;
  white-space: pre-wrap; overflow-wrap: anywhere;
  font-family: ${MONO_FONT};
}
.wh-value.wh-prose { font-family: ${UI_FONT}; font-size: 12px; }
.wh-empty-value { color: #6b7280; font-style: italic; font-family: ${UI_FONT}; }
.wh-invisible {
  display: inline-block; margin: 0 1px; padding: 0 3px; border-radius: 3px;
  font: 600 8px/1.6 ${MONO_FONT}; letter-spacing: .02em; vertical-align: 1px;
  color: #fde68a; background: rgba(245,158,11,.18); border: 1px solid rgba(245,158,11,.45);
  unicode-bidi: isolate; direction: ltr;
}
.wh-explain { color: #cbd5e1; margin-bottom: 8px; }
.wh-fix { color: #e5e7eb; background: #111827; border-inline-start: 3px solid #22c55e; border-radius: 4px; padding: 6px 8px; }
.wh-fix strong { color: #86efac; }
.wh-code {
  font-family: ${MONO_FONT}; font-size: .92em; color: #e2e8f0;
  background: rgba(148,163,184,.14); border-radius: 4px; padding: 0 3px;
  unicode-bidi: isolate; overflow-wrap: anywhere;
}
.wh-param { unicode-bidi: isolate; color: #f8fafc; }
.wh-docs { display: inline-block; margin-top: 6px; color: #60a5fa; text-decoration: none; font-size: 11px; }
.wh-docs:hover { text-decoration: underline; }
.wh-hint {
  display: none; align-items: center; gap: 8px;
  padding: 7px 12px; font-size: 11px; color: #cbd5e1;
  background: #0d1220; border-top: 1px solid #1f2937;
  animation: wh-fade .2s ease;
}
.wh-hint.wh-show { display: flex; }
.wh-hint-text { flex: 1; }
.wh-hint-x {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  color: #9ca3af; font-size: 14px; line-height: 1; padding: 2px 4px;
}
.wh-hint-x:hover { color: #f3f4f6; }
@keyframes wh-fade { from { opacity: 0 } to { opacity: 1 } }
@media (max-width: 420px) {
  .wh-panel { width: auto; max-height: min(80vh, 640px); }
  .wh-bottom-right, .wh-bottom-left { left: 8px; right: 8px; }
  .wh-top-right, .wh-top-left { left: 8px; right: 8px; }
  .wh-diff { grid-template-columns: 1fr; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function shortenPath(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const marker = normalized.match(/(?:^|\/)(?:src|app|pages|components)\//);
  if (marker && marker.index != null) {
    return normalized.slice(marker.index).replace(/^\//, '');
  }
  const parts = normalized.split('/');
  return parts.slice(-2).join('/');
}

// Characters that change layout while rendering as nothing. In a value cell
// they are exactly what differs between server and client in the bidi-mark
// case, so they are drawn as labelled badges instead of being applied.
const INVISIBLE: Readonly<Record<string, string>> = {
  '\u200b': 'ZWSP',
  '\u200e': 'LRM',
  '\u200f': 'RLM',
  '\u061c': 'ALM',
  '\u202a': 'LRE',
  '\u202b': 'RLE',
  '\u202c': 'PDF',
  '\u202d': 'LRO',
  '\u202e': 'RLO',
  '\u2066': 'LRI',
  '\u2067': 'RLI',
  '\u2068': 'FSI',
  '\u2069': 'PDI',
  '\ufeff': 'BOM',
};
const INVISIBLE_RE =
  /[\u200b\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]/;
const INVISIBLE_SPLIT =
  /([\u200b\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff])/;

// Hebrew, Arabic, Syriac, Thaana, N'Ko and the Arabic presentation forms.
const RTL_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;

function renderValue(
  value: string | null,
  strings: OverlayStrings,
): HTMLElement {
  if (value == null || value === '') {
    return el(
      'span',
      'wh-empty-value',
      value === '' ? strings.empty : strings.none,
    );
  }
  const block = el('div', 'wh-value');
  block.dir = 'auto';
  // Human text in a right-to-left script reads as prose, not code: a
  // monospace face either lacks those glyphs or draws them disconnected.
  if (RTL_SCRIPT.test(value)) block.classList.add('wh-prose');
  if (!INVISIBLE_RE.test(value)) {
    block.textContent = value;
    return block;
  }
  for (const part of value.split(INVISIBLE_SPLIT)) {
    if (!part) continue;
    const name = INVISIBLE[part];
    if (!name) {
      block.append(part);
      continue;
    }
    const badge = el('span', 'wh-invisible', name);
    const cp = part.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    badge.title = `U+${cp} ${name}`;
    block.appendChild(badge);
  }
  return block;
}

function renderSegments(segments: readonly MessageSegment[]): DocumentFragment {
  const out = document.createDocumentFragment();
  for (const s of segments) {
    if (typeof s === 'string') {
      out.append(s);
    } else if ('code' in s) {
      const c = el('code', 'wh-code', s.code);
      c.dir = 'auto';
      out.appendChild(c);
    } else {
      const v = el('bdi', 'wh-param', s.value);
      out.appendChild(v);
    }
  }
  return out;
}

// A custom classifier's text has no template; still render its backtick spans
// as code, without touching anything that looks like a `{placeholder}`.
function splitCode(text: string): MessageSegment[] {
  return text
    .split('`')
    .map((part, i) => (i % 2 === 1 ? { code: part } : part))
    .filter((s) => s !== '');
}

/**
 * The words for one field of a cause, in the overlay's language. A cause is
 * only translated when it is provably one of ours: a known `messageId` whose
 * English rendering is exactly the text the cause carries. Anything else — a
 * custom classifier, or one that reused an id with its own wording — is shown
 * as written, and flagged so it can be laid out in its own direction.
 */
function causeText(
  cause: Cause,
  field: 'explanation' | 'suggestion',
  strings: OverlayStrings,
): { segments: MessageSegment[]; translated: boolean } {
  const id = cause.messageId as MessageId | undefined;
  const params = cause.params ?? {};
  if (id && Object.prototype.hasOwnProperty.call(EN_MESSAGES, id)) {
    const english = plainText(renderMessage(EN_MESSAGES[id][field], params));
    if (english === cause[field]) {
      return {
        segments: renderMessage(strings.messages[id][field], params),
        translated: true,
      };
    }
  }
  return { segments: splitCode(cause[field]), translated: false };
}

function renderCard(
  report: HydrationReport,
  strings: OverlayStrings,
): HTMLElement {
  const card = el('div', 'wh-card');

  const head = el('div', 'wh-card-head');
  head.appendChild(
    el(
      'span',
      'wh-cat',
      strings.categories[report.cause.category] ?? strings.fallbackCategory,
    ),
  );
  const conf = el(
    'span',
    'wh-conf',
    `${Math.round(report.cause.confidence * 100)}%`,
  );
  conf.dir = 'ltr';
  head.appendChild(conf);
  card.appendChild(head);

  const body = el('div', 'wh-body');

  const where = el('div', 'wh-where');
  const name = report.component ?? report.node.tagName?.toLowerCase();
  if (name) {
    const comp = el(
      'bdi',
      report.component ? 'wh-comp' : 'wh-attr',
      `<${name}>`,
    );
    comp.dir = 'ltr';
    where.append(comp, ' · ');
  }
  const path = el('code', undefined, report.node.path);
  path.dir = 'ltr';
  where.appendChild(path);
  if (report.node.attribute) {
    const attr = el('bdi', 'wh-attr', `@${report.node.attribute}`);
    attr.dir = 'ltr';
    where.append(' · ', attr);
  }
  body.appendChild(where);

  if (report.location?.file) {
    const file = shortenPath(report.location.file);
    const loc = el(
      'div',
      'wh-loc',
      report.location.line ? `${file}:${report.location.line}` : file,
    );
    loc.dir = 'ltr';
    body.appendChild(loc);
  }

  const diff = el('div', 'wh-diff');
  const server = el('div', 'wh-side wh-server');
  server.appendChild(el('span', 'wh-label', strings.server));
  server.appendChild(renderValue(report.server, strings));
  const client = el('div', 'wh-side wh-client');
  client.appendChild(el('span', 'wh-label', strings.client));
  client.appendChild(renderValue(report.client, strings));
  diff.appendChild(server);
  diff.appendChild(client);
  body.appendChild(diff);

  const explanation = causeText(report.cause, 'explanation', strings);
  const explain = el('div', 'wh-explain');
  // Untranslated text keeps its own direction: an English sentence inside
  // the Arabic panel would otherwise read with its punctuation reversed.
  explain.dir = explanation.translated ? strings.dir : 'auto';
  explain.appendChild(renderSegments(explanation.segments));
  body.appendChild(explain);

  const suggestion = causeText(report.cause, 'suggestion', strings);
  const fix = el('div', 'wh-fix');
  fix.appendChild(el('strong', undefined, strings.fix));
  fix.append(' ');
  const fixText = el('span');
  fixText.dir = suggestion.translated ? strings.dir : 'auto';
  fixText.appendChild(renderSegments(suggestion.segments));
  fix.appendChild(fixText);
  body.appendChild(fix);

  if (report.cause.docsUrl && /^https?:\/\//i.test(report.cause.docsUrl)) {
    const a = el('a', 'wh-docs', strings.learnMore);
    a.href = report.cause.docsUrl;
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    body.appendChild(a);
  }

  card.appendChild(body);
  return card;
}

export function createOverlay(options: OverlayOptions = {}): OverlayHandle {
  const position = options.position ?? 'bottom-right';
  let host: HTMLElement | null = null;
  let listEl: HTMLElement | null = null;
  let countEl: HTMLElement | null = null;
  let hintEl: HTMLElement | null = null;
  let hintTextEl: HTMLElement | null = null;
  let hintCheckTimer: ReturnType<typeof setTimeout> | null = null;
  let hintDismissed = false;
  let count = 0;
  let strings: OverlayStrings = OVERLAY_STRINGS.en;

  function ensureMounted(): void {
    if (host) return;
    document.getElementById(CONTAINER_ID)?.remove();
    // Resolved per mount, so a page whose <html lang> is set after load picks
    // it up the next time the panel appears.
    const locale = resolveLocale(options.locale);
    strings = OVERLAY_STRINGS[locale];

    host = document.createElement('div');
    host.id = CONTAINER_ID;
    host.setAttribute('data-why-hydration', 'overlay');
    host.setAttribute('aria-hidden', 'false');
    host.setAttribute('dir', strings.dir);
    host.setAttribute('lang', locale);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const panel = el('div', `wh-panel wh-${position}`);
    // Direction and language live on the panel, inside the shadow root, where
    // no stylesheet from the host page can override them. `lang` also makes a
    // screen reader voice the panel in its own language rather than the
    // page's — without it, English text is read aloud with an Arabic voice.
    panel.setAttribute('dir', strings.dir);
    panel.setAttribute('lang', locale);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', strings.dialogLabel);

    const header = el('div', 'wh-header');
    header.appendChild(el('span', 'wh-dot'));
    header.appendChild(el('span', 'wh-title', strings.title));
    countEl = el('span', 'wh-count', '0');
    countEl.dir = 'ltr';
    header.appendChild(countEl);
    const close = el('button', 'wh-btn', strings.dismiss);
    close.setAttribute('aria-label', strings.dismissLabel);
    close.addEventListener('click', () => destroy());
    header.appendChild(close);
    panel.appendChild(header);

    listEl = el('div', 'wh-list');
    panel.appendChild(listEl);

    hintEl = el('div', 'wh-hint');
    hintTextEl = el('span', 'wh-hint-text');
    hintEl.appendChild(hintTextEl);
    const hintX = el('button', 'wh-hint-x', '✕');
    hintX.setAttribute('aria-label', strings.hintDismissLabel);
    hintX.addEventListener('click', () => dismissHint());
    hintEl.appendChild(hintX);
    panel.appendChild(hintEl);

    shadow.appendChild(panel);
    document.body.appendChild(host);

    host.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') destroy();
    });
  }

  function dismissHint(): void {
    hintDismissed = true;
    hintEl?.classList.remove('wh-show');
  }

  // Show a persistent "scroll for more" hint once there are enough issues that
  // the panel is guaranteed to overflow (cards are ~150px+, panel caps at
  // ~640px, so 4+ always scroll). Count-based — no async layout measurement —
  // and only ever ADDS the class. It's removed only by its own ✕ button.
  function updateHint(): void {
    if (!hintEl || !hintTextEl || hintDismissed) return;
    hintTextEl.textContent = strings.hint(count);
    if (count >= 4) hintEl.classList.add('wh-show');
  }

  // Tears the panel down to nothing — including the counters, which describe
  // the cards in the list rather than the reports ever seen. `push` re-mounts
  // an empty panel, so a stale count would have it claim "14 issues — scroll to
  // see all" above a single card that does not scroll.
  function destroy(): void {
    if (hintCheckTimer) clearTimeout(hintCheckTimer);
    hintCheckTimer = null;
    host?.remove();
    host = null;
    listEl = null;
    countEl = null;
    hintEl = null;
    hintTextEl = null;
    count = 0;
    hintDismissed = false;
  }

  function push(report: HydrationReport): void {
    ensureMounted();
    count += 1;
    if (countEl) countEl.textContent = String(count);
    listEl?.appendChild(renderCard(report, strings));
    // Debounce: reports arrive in bursts across the settling window. Evaluate
    // the hint once things go quiet.
    if (hintCheckTimer) clearTimeout(hintCheckTimer);
    hintCheckTimer = setTimeout(updateHint, 400);
  }

  return { push, destroy };
}
