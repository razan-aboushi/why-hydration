/**
 * The overlay in Arabic (RTL) and English (LTR).
 *
 * An Arabic page gets an Arabic, right-to-left panel; every other page gets
 * English. Either way, the page's own data must render in its own direction:
 * a value like `السعر: ١٬٤٠٠ د.ك.` inside an English panel, or a CSS selector
 * inside an Arabic one, has to keep its punctuation and brackets where they
 * belong. That is done by giving each piece the right `dir` and isolating it,
 * which is what these assert.
 *
 * jsdom does no text layout, so the rendered positions themselves are checked
 * in a real browser; this file pins the structure that produces them.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOverlay, type OverlayOptions } from '../src/react/overlay';
import { OVERLAY_STRINGS, resolveLocale } from '../src/react/i18n';
import { classify } from '../src/core/classify';
import {
  EN_MESSAGES,
  classDetail,
  plainText,
  renderMessage,
  valueList,
  type MessageId,
} from '../src/core/classify/messages';
import { InspectorController } from '../src/react/controller';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { Cause, Divergence, HydrationReport } from '../src/core/types';

const ARABIC = /[\u0600-\u06ff]/;

let n = 0;
function reportFor(
  divergence: Divergence,
  overrides: Partial<HydrationReport> = {},
): HydrationReport {
  n += 1;
  return {
    id: `r${n}`,
    timestamp: 0,
    node: {
      path: divergence.path,
      kind: divergence.kind,
      tagName: divergence.tagName,
      attribute: divergence.attribute,
    },
    server: divergence.server,
    client: divergence.client,
    cause: classify(divergence),
    ...overrides,
  };
}

function text(server: string | null, client: string | null): Divergence {
  return {
    kind: 'text',
    path: 'div > span:nth-child(1) > #text[0]',
    server,
    client,
  };
}

function mount(
  lang: string | null,
  report: HydrationReport,
  options: OverlayOptions = {},
): { shadow: ShadowRoot; panel: Element; card: Element; destroy: () => void } {
  if (lang == null) document.documentElement.removeAttribute('lang');
  else document.documentElement.setAttribute('lang', lang);
  const overlay = createOverlay(options);
  overlay.push(report);
  const shadow = document.getElementById('why-hydration-overlay')!.shadowRoot!;
  return {
    shadow,
    panel: shadow.querySelector('.wh-panel')!,
    card: shadow.querySelector('.wh-card')!,
    destroy: overlay.destroy,
  };
}

afterEach(() => {
  resetCapture();
  document.getElementById('why-hydration-overlay')?.remove();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('which language the overlay speaks', () => {
  it.each([
    ['ar', 'ar'],
    ['ar-SA', 'ar'],
    ['ar-EG', 'ar'],
    ['AR', 'ar'],
    [' ar ', 'ar'],
    ['arz', 'ar'],
    ['ary-MA', 'ar'],
    ['en', 'en'],
    ['en-US', 'en'],
    ['fr', 'en'],
    ['he', 'he'],
    ['he-IL', 'he'],
    // The pre-1989 Hebrew code, which some systems still emit.
    ['iw', 'he'],
    ['fa', 'fa'],
    ['fa-IR', 'fa'],
    // Dari and the Iranian Persian code.
    ['prs', 'fa'],
    ['pes', 'fa'],
    // Right-to-left, but not a language the overlay translates.
    ['ur', 'en'],
    ['yi', 'en'],
    // Must not be mistaken for Arabic by a loose prefix match.
    ['arn', 'en'],
    ['', 'en'],
  ])('auto on <html lang="%s"> → %s', (lang, expected) => {
    document.documentElement.setAttribute('lang', lang);
    expect(resolveLocale('auto')).toBe(expected);
    expect(resolveLocale(undefined)).toBe(expected);
  });

  it('defaults to English when the page declares no language', () => {
    document.documentElement.removeAttribute('lang');
    expect(resolveLocale()).toBe('en');
  });

  it('lets an explicit locale override the page either way', () => {
    document.documentElement.setAttribute('lang', 'ar');
    expect(resolveLocale('en')).toBe('en');
    document.documentElement.setAttribute('lang', 'en');
    expect(resolveLocale('ar')).toBe('ar');
  });

  it('falls back to English for an unsupported locale rather than guessing', () => {
    document.documentElement.setAttribute('lang', 'ar');
    expect(resolveLocale('fr')).toBe('en');
  });

  it('ignores the page direction — dir alone does not pick a language', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ur');
    expect(resolveLocale()).toBe('en');
  });
});

describe('the Arabic panel', () => {
  const report = reportFor(text('١٢٣٤', '1234'));

  it('is right-to-left and declared as Arabic', () => {
    const { panel, destroy } = mount('ar', report);
    expect(panel.getAttribute('dir')).toBe('rtl');
    expect(panel.getAttribute('lang')).toBe('ar');
    expect(
      document.getElementById('why-hydration-overlay')!.getAttribute('dir'),
    ).toBe('rtl');
    destroy();
  });

  it('translates every piece of chrome', () => {
    const { shadow, card, destroy } = mount('ar', report);
    const ar = OVERLAY_STRINGS.ar;
    expect(shadow.querySelector('.wh-title')!.textContent).toBe(ar.title);
    expect(shadow.querySelector('.wh-btn')!.textContent).toBe('إغلاق');
    expect(card.querySelector('.wh-cat')!.textContent).toBe(
      'تنسيق اللغة والمنطقة',
    );
    const labels = [...card.querySelectorAll('.wh-label')].map(
      (l) => l.textContent,
    );
    expect(labels).toEqual(['الخادم', 'العميل']);
    expect(card.querySelector('.wh-fix strong')!.textContent).toBe('الحل:');
    expect(card.querySelector('.wh-docs')!.textContent).toContain(
      'اعرف المزيد',
    );
    destroy();
  });

  it('translates the accessible names a screen reader announces', () => {
    const { shadow, panel, destroy } = mount('ar', report);
    expect(panel.getAttribute('aria-label')).toBe(
      'تشخيص عدم تطابق الـ Hydration',
    );
    expect(shadow.querySelector('.wh-btn')!.getAttribute('aria-label')).toBe(
      'إغلاق لوحة التشخيص',
    );
    expect(shadow.querySelector('.wh-hint-x')!.getAttribute('aria-label')).toBe(
      'إخفاء التلميح',
    );
    destroy();
  });

  it('writes the explanation and fix in Arabic, laid out right-to-left', () => {
    const { card, destroy } = mount('ar', report);
    const explain = card.querySelector('.wh-explain')!;
    const fix = card.querySelector('.wh-fix > span')!;
    expect(explain.textContent).toMatch(ARABIC);
    expect(explain.textContent).not.toContain('The same value');
    expect(explain.getAttribute('dir')).toBe('rtl');
    expect(fix.textContent).toMatch(ARABIC);
    expect(fix.getAttribute('dir')).toBe('rtl');
    destroy();
  });

  it('keeps the empty-value placeholders in Arabic', () => {
    const { card, destroy } = mount('ar', reportFor(text('', 'guest')));
    expect(card.querySelector('.wh-server .wh-empty-value')!.textContent).toBe(
      '(فارغ)',
    );
    destroy();
  });

  it('can be forced to English on an Arabic page', () => {
    const { panel, shadow, destroy } = mount('ar', report, { locale: 'en' });
    expect(panel.getAttribute('dir')).toBe('ltr');
    // Without its own lang, English text inherits the page's `ar` and a
    // screen reader voices it with an Arabic voice.
    expect(panel.getAttribute('lang')).toBe('en');
    expect(shadow.querySelector('.wh-title')!.textContent).toBe(
      'Hydration mismatch',
    );
    destroy();
  });

  it('can be forced to Arabic on an English page', () => {
    const { panel, destroy } = mount('en', report, { locale: 'ar' });
    expect(panel.getAttribute('dir')).toBe('rtl');
    expect(panel.getAttribute('lang')).toBe('ar');
    destroy();
  });
});

describe('the English panel is unchanged', () => {
  it('uses the same words it always has', () => {
    const { shadow, card, panel, destroy } = mount(
      'en',
      reportFor(text('١٢٣٤', '1234')),
    );
    expect(panel.getAttribute('dir')).toBe('ltr');
    expect(shadow.querySelector('.wh-title')!.textContent).toBe(
      'Hydration mismatch',
    );
    expect(shadow.querySelector('.wh-btn')!.textContent).toBe('Dismiss');
    expect(card.querySelector('.wh-cat')!.textContent).toBe(
      'Locale formatting',
    );
    expect(card.querySelector('.wh-fix strong')!.textContent).toBe('Fix:');
    expect(card.querySelector('.wh-docs')!.textContent).toBe('Learn more →');
    destroy();
  });

  it('renders exactly the explanation the report carries', () => {
    const r = reportFor(text('١٢٣٤', '1234'));
    const { card, destroy } = mount('en', r);
    // Code spans render as <code> rather than backticks; the words are the
    // cause's own.
    expect(card.querySelector('.wh-explain')!.textContent).toBe(
      r.cause.explanation.replace(/`/g, ''),
    );
    destroy();
  });
});

// Every built-in variant, rendered in Arabic.
const VARIANTS: Array<[MessageId, Divergence]> = [
  ['non-deterministic-value', text('0.5488135039273248', '0.7151893663724195')],
  ['date-time', text('10:30 AM', '11:45 AM')],
  ['locale-format.bidi', text('٢٠٢٤/١/٢', '٢٠٢٤/١/٢\u200f')],
  ['locale-format.script', text('١٢٣٤', '1234')],
  ['locale-format.separators', text('1,234.56', '1.234,56')],
  ['locale-format.date-order', text('٢٠٢٤/٠١/٠٢', '٠٢/٠١/٢٠٢٤')],
  ['browser-only-api', text('', 'guest')],
  [
    'viewport-branching',
    {
      kind: 'structure',
      path: 'div',
      tagName: 'ASIDE',
      parentTagName: 'DIV',
      server: '<section>a</section>',
      client: '<aside>b</aside>',
    },
  ],
  [
    'invalid-html-nesting',
    {
      kind: 'structure',
      path: 'p',
      tagName: 'DIV',
      parentTagName: 'P',
      server: null,
      client: '<div>x</div>',
    },
  ],
  ['whitespace-minification', text('alpha   beta', 'alpha beta')],
  [
    'third-party-dom-mutation.extension-attribute',
    {
      kind: 'attribute',
      path: 'p',
      attribute: 'data-gramm',
      server: null,
      client: 'false',
    },
  ],
  [
    'third-party-dom-mutation.root-attribute',
    {
      kind: 'attribute',
      path: 'body',
      attribute: 'data-foo',
      server: null,
      client: 'x',
      element: document.createElement('body'),
    },
  ],
  [
    'third-party-dom-mutation.injected-node',
    {
      kind: 'node-added',
      path: 'div',
      tagName: 'IFRAME',
      server: null,
      client: '<iframe src="about:blank"></iframe>',
    },
  ],
  [
    'attribute-mismatch.class',
    {
      kind: 'attribute',
      path: 'p',
      attribute: 'class',
      server: 'بطاقة',
      client: 'بطاقة مخفي بارز',
    },
  ],
  [
    'attribute-mismatch.style',
    {
      kind: 'attribute',
      path: 'p',
      attribute: 'style',
      server: 'color:red',
      client: 'color:blue',
    },
  ],
  [
    'attribute-mismatch.generic',
    {
      kind: 'attribute',
      path: 'p',
      attribute: 'title',
      server: 'مرحبا!',
      client: 'أهلا!',
    },
  ],
  ['unknown', text('a', 'b')],
  [
    'unknown.no-location',
    { kind: 'structure', path: 'body', server: null, client: null },
  ],
];

describe('every built-in cause, in Arabic', () => {
  it('covers every message id there is', () => {
    const covered = VARIANTS.map(([id]) => id).sort();
    expect(covered).toEqual(Object.keys(EN_MESSAGES).sort());
  });

  it.each(VARIANTS)('%s', (id, divergence) => {
    const r = reportFor(divergence);
    expect(r.cause.messageId).toBe(id);
    const { card, destroy } = mount('ar', r);

    for (const selector of ['.wh-explain', '.wh-fix > span']) {
      const node = card.querySelector(selector)!;
      expect(node.getAttribute('dir')).toBe('rtl');
      expect(node.textContent).toMatch(ARABIC);
      // Nothing may leak through untranslated or half-substituted.
      expect(node.textContent).not.toMatch(/\{\w+\}|`/);
    }
    destroy();
  });
});

describe('page data and code keep their own direction', () => {
  it('gives each value its own direction, as a block', () => {
    const { card, destroy } = mount(
      'en',
      reportFor(text('السعر: ١٬٤٠٠ د.ك.', 'Price: 1,400 KWD.')),
    );
    const [server, client] = [...card.querySelectorAll('.wh-value')];
    for (const v of [server!, client!]) {
      expect(v.getAttribute('dir')).toBe('auto');
      expect(v.tagName).toBe('DIV');
    }
    expect(server!.textContent).toBe('السعر: ١٬٤٠٠ د.ك.');
    expect(client!.textContent).toBe('Price: 1,400 KWD.');
    destroy();
  });

  it('draws Arabic values in a proportional face, and code-like values in mono', () => {
    const { card, destroy } = mount(
      'ar',
      reportFor(text('مرحبا بك', 'user_42')),
    );
    const [server, client] = [...card.querySelectorAll('.wh-value')];
    expect(server!.classList.contains('wh-prose')).toBe(true);
    expect(client!.classList.contains('wh-prose')).toBe(false);
    destroy();
  });

  it('keeps selectors, component names and attributes left-to-right', () => {
    const r = reportFor(
      {
        kind: 'attribute',
        path: 'div > p:nth-child(2)',
        attribute: 'title',
        server: 'أ',
        client: 'ب',
      },
      {
        component: 'PriceTag',
        location: { file: '/app/src/PriceTag.tsx', line: 12 },
      },
    );
    const { card, destroy } = mount('ar', r);
    const where = card.querySelector('.wh-where')!;
    expect(where.querySelector('code')!.getAttribute('dir')).toBe('ltr');
    expect(where.querySelector('.wh-comp')!.getAttribute('dir')).toBe('ltr');
    expect(where.querySelector('.wh-comp')!.textContent).toBe('<PriceTag>');
    const attr = [...where.querySelectorAll('.wh-attr')].find((a) =>
      a.textContent!.startsWith('@'),
    )!;
    expect(attr.getAttribute('dir')).toBe('ltr');
    expect(card.querySelector('.wh-loc')!.getAttribute('dir')).toBe('ltr');
    expect(card.querySelector('.wh-conf')!.getAttribute('dir')).toBe('ltr');
    destroy();
  });

  it('isolates each class token inside the sentence', () => {
    const r = reportFor({
      kind: 'attribute',
      path: 'p',
      attribute: 'class',
      server: 'بطاقة',
      client: 'بطاقة مخفي بارز',
    });
    for (const lang of ['ar', 'en']) {
      const { card, destroy } = mount(lang, r);
      const tokens = [...card.querySelectorAll('.wh-explain bdi.wh-param')].map(
        (b) => b.textContent,
      );
      // One isolate per token: joined into one run, two Arabic tokens would
      // swap places inside a left-to-right sentence.
      expect(tokens).toEqual(['مخفي', 'بارز']);
      destroy();
    }
  });

  it('renders code spans as isolated <code>, not literal backticks', () => {
    const { card, destroy } = mount('ar', reportFor(text('١٢٣٤', '1234')));
    const codes = [...card.querySelectorAll('.wh-fix code.wh-code')];
    expect(codes.map((c) => c.textContent)).toContain('Intl.NumberFormat');
    for (const c of codes) expect(c.getAttribute('dir')).toBe('auto');
    destroy();
  });

  it('keeps an attribute value as its own isolate inside a code span', () => {
    const r = reportFor({
      kind: 'attribute',
      path: 'p',
      attribute: 'title',
      server: 'مرحبا!',
      client: 'أهلا!',
    });
    const { card, destroy } = mount('ar', r);
    const codes = [...card.querySelectorAll('.wh-explain code.wh-code')].map(
      (c) => c.textContent,
    );
    expect(codes).toEqual(['title', 'مرحبا!', 'أهلا!']);
    destroy();
  });
});

describe('what a value cell shows', () => {
  it('preserves whitespace, so a whitespace-only mismatch is visible', () => {
    const { card, destroy } = mount(
      'en',
      reportFor(text('alpha   beta', 'alpha beta')),
    );
    const [server, client] = [...card.querySelectorAll('.wh-value')];
    expect(server!.textContent).toBe('alpha   beta');
    expect(client!.textContent).toBe('alpha beta');
    destroy();
  });

  it('draws invisible bidi marks as labelled badges', () => {
    const { card, destroy } = mount(
      'ar',
      reportFor(text('٢٠٢٤/١/٢', '٢٠٢٤/١/٢\u200f')),
    );
    const [server, client] = [...card.querySelectorAll('.wh-value')];
    // Otherwise the two cells look identical — the whole point of the report.
    expect(server!.querySelector('.wh-invisible')).toBeNull();
    const badge = client!.querySelector('.wh-invisible')!;
    expect(badge.textContent).toBe('RLM');
    expect(badge.getAttribute('title')).toBe('U+200F RLM');
    // The mark itself is not in the DOM, so it cannot reorder the value.
    expect(client!.textContent).not.toContain('\u200f');
    destroy();
  });

  it.each([
    ['\u200e', 'LRM'],
    ['\u061c', 'ALM'],
    ['\u2066', 'LRI'],
    ['\u2069', 'PDI'],
    ['\u200b', 'ZWSP'],
    ['\ufeff', 'BOM'],
  ])('labels U+%s', (ch, name) => {
    const { card, destroy } = mount('en', reportFor(text('a', `a${ch}`)));
    const badges = [...card.querySelectorAll('.wh-client .wh-invisible')];
    expect(badges.map((b) => b.textContent)).toEqual([name]);
    destroy();
  });

  it('leaves joiners inside words alone', () => {
    // ZWNJ is part of ordinary Persian spelling; badging it would be noise.
    const { card, destroy } = mount(
      'en',
      reportFor(text('می\u200cخواهم', 'میخواهم')),
    );
    expect(card.querySelector('.wh-invisible')).toBeNull();
    destroy();
  });

  it('still renders markup-shaped values as text in both languages', () => {
    for (const lang of ['ar', 'en']) {
      const { shadow, card, destroy } = mount(
        lang,
        reportFor(text('<img src=x onerror="boom()">', 'ب')),
      );
      expect(shadow.querySelector('img')).toBeNull();
      expect(card.querySelector('.wh-server')!.textContent).toContain(
        '<img src=x onerror="boom()">',
      );
      destroy();
    }
  });
});

describe('a cause the overlay did not write', () => {
  const custom: Cause = {
    category: 'unknown',
    confidence: 0.99,
    explanation: 'Our CMS rewrote `data-x` on the client.',
    suggestion: 'Pin the CMS version.',
  };

  it('is shown as written, in its own direction, in the Arabic panel', () => {
    const { card, destroy } = mount(
      'ar',
      reportFor(text('a', 'b'), { cause: custom }),
    );
    const explain = card.querySelector('.wh-explain')!;
    expect(explain.textContent).toBe('Our CMS rewrote data-x on the client.');
    // An English sentence in an RTL block would read with its full stop first.
    expect(explain.getAttribute('dir')).toBe('auto');
    expect(card.querySelector('.wh-fix > span')!.getAttribute('dir')).toBe(
      'auto',
    );
    // The chrome around it is still Arabic.
    expect(card.querySelector('.wh-fix strong')!.textContent).toBe('الحل:');
    destroy();
  });

  it('is not replaced when it reuses a built-in id with its own words', () => {
    const reused: Cause = { ...custom, messageId: 'unknown' };
    const { card, destroy } = mount(
      'ar',
      reportFor(text('a', 'b'), { cause: reused }),
    );
    expect(card.querySelector('.wh-explain')!.textContent).toBe(
      'Our CMS rewrote data-x on the client.',
    );
    destroy();
  });

  it('keeps literal braces instead of treating them as placeholders', () => {
    const braces: Cause = { ...custom, explanation: 'Value {x} changed.' };
    const { card, destroy } = mount(
      'en',
      reportFor(text('a', 'b'), { cause: braces }),
    );
    expect(card.querySelector('.wh-explain')!.textContent).toBe(
      'Value {x} changed.',
    );
    destroy();
  });
});

describe('the scroll hint', () => {
  const hint = (count: number, lang: string) => {
    document.documentElement.setAttribute('lang', lang);
    return OVERLAY_STRINGS[resolveLocale()].hint(count);
  };

  it('keeps the English wording', () => {
    expect(hint(6, 'en')).toBe('↓ 6 issues — scroll to see all');
  });

  it.each([
    [1, 'مشكلة واحدة'],
    [2, 'مشكلتان'],
    [4, '4 مشكلات'],
    [10, '10 مشكلات'],
    [11, '11 مشكلة'],
    [25, '25 مشكلة'],
    [100, '100 مشكلة'],
    [103, '103 مشكلات'],
  ])('uses the right Arabic plural for %i', (count, expected) => {
    expect(hint(count, 'ar')).toBe(`↓ ${expected} — مرّر لرؤية الكل`);
  });

  it('shows the Arabic hint once the panel overflows', async () => {
    document.documentElement.setAttribute('lang', 'ar');
    const overlay = createOverlay();
    for (let i = 0; i < 5; i++) overlay.push(reportFor(text(`s${i}`, `c${i}`)));
    await new Promise((r) => setTimeout(r, 450));
    const shadow = document.getElementById(
      'why-hydration-overlay',
    )!.shadowRoot!;
    expect(
      shadow.querySelector('.wh-hint')!.classList.contains('wh-show'),
    ).toBe(true);
    expect(shadow.querySelector('.wh-hint-text')!.textContent).toBe(
      '↓ 5 مشكلات — مرّر لرؤية الكل',
    );
    overlay.destroy();
  });
});

describe('the stylesheet lays out both directions', () => {
  const css = (): string => {
    const { shadow, destroy } = mount('ar', reportFor(text('a', 'b')));
    const s = shadow.querySelector('style')!.textContent ?? '';
    destroy();
    return s;
  };

  it('uses logical properties, so the layout mirrors with the direction', () => {
    const s = css();
    expect(s).toMatch(/\.wh-count\s*{[^}]*margin-inline-start:\s*auto/);
    expect(s).toMatch(/\.wh-conf\s*{[^}]*margin-inline-start:\s*auto/);
    expect(s).toMatch(/\.wh-fix\s*{[^}]*border-inline-start:/);
    expect(s).not.toMatch(/margin-left:\s*auto|border-left:/);
  });

  it('does not letter-space or uppercase Arabic labels', () => {
    // Letter-spacing breaks the joins between Arabic letters.
    expect(css()).toMatch(
      /\.wh-panel\[dir="rtl"\] \.wh-side \.wh-label\s*{[^}]*letter-spacing:\s*0/,
    );
  });

  it('lets each value line take its own direction', () => {
    const s = css();
    expect(s).toMatch(/\.wh-value\s*{[^}]*unicode-bidi:\s*plaintext/);
    expect(s).toMatch(/\.wh-value\s*{[^}]*white-space:\s*pre-wrap/);
  });

  it('never leaves Arabic to a monospace fallback', () => {
    expect(css()).toMatch(
      /\.wh-value\.wh-prose\s*{[^}]*font-family:[^;]*Noto Sans Arabic/,
    );
  });
});

describe('re-mounting', () => {
  it('picks up a language the page set after the first mount', () => {
    document.documentElement.setAttribute('lang', 'en');
    const overlay = createOverlay();
    overlay.push(reportFor(text('a', 'b')));
    const panel = () =>
      document
        .getElementById('why-hydration-overlay')!
        .shadowRoot!.querySelector('.wh-panel')!;
    expect(panel().getAttribute('dir')).toBe('ltr');

    overlay.destroy();
    document.documentElement.setAttribute('lang', 'ar');
    overlay.push(reportFor(text('c', 'd')));
    expect(panel().getAttribute('dir')).toBe('rtl');
    overlay.destroy();
  });
});

describe('the message catalog', () => {
  it('has an Arabic entry for every English one, and none extra', () => {
    expect(Object.keys(OVERLAY_STRINGS.ar.messages).sort()).toEqual(
      Object.keys(EN_MESSAGES).sort(),
    );
  });

  it('has an Arabic label for every category', () => {
    expect(Object.keys(OVERLAY_STRINGS.ar.categories).sort()).toEqual(
      Object.keys(OVERLAY_STRINGS.en.categories).sort(),
    );
    for (const label of Object.values(OVERLAY_STRINGS.ar.categories)) {
      expect(label).toMatch(ARABIC);
    }
  });

  it('never has unbalanced backticks in a string template', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const [id, entry] of Object.entries(
        OVERLAY_STRINGS[lang].messages,
      )) {
        for (const t of [entry.explanation, entry.suggestion]) {
          if (typeof t !== 'string') continue;
          expect((t.match(/`/g) ?? []).length % 2, `${lang} ${id}`).toBe(0);
        }
      }
    }
  });

  it('parses code spans, values, and params inside code', () => {
    const segs = renderMessage('Set `{attr}` to {value} via `x`.', {
      attr: 'dir',
      value: 'rtl',
    });
    expect(segs).toEqual([
      'Set ',
      { code: 'dir' },
      ' to ',
      { value: 'rtl' },
      ' via ',
      { code: 'x' },
      '.',
    ]);
    expect(plainText(segs)).toBe('Set `dir` to rtl via `x`.');
  });

  it('writes the class detail clause for every combination', () => {
    const words = {
      added: '+',
      removed: '-',
      listSeparator: ',',
      partSeparator: ';',
      open: '(',
      close: ')',
    };
    const render = (added: string[], removed: string[]) =>
      plainText(classDetail({ added, removed }, words));
    expect(render([], [])).toBe('');
    expect(render(['a', 'b'], [])).toBe('(+a,b)');
    expect(render([], ['c'])).toBe('(-c)');
    expect(render(['a'], ['c'])).toBe('(+a;-c)');
  });

  it('isolates each list item separately', () => {
    expect(valueList(['a', 'b'], ', ')).toEqual([
      { value: 'a' },
      ', ',
      { value: 'b' },
    ]);
  });
});

// ---------------------------------------------------------------------------

function seed(serverHtml: string, clientHtml: string): void {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'root';
  root.innerHTML = clientHtml;
  document.body.appendChild(root);
  (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
    version: 1,
    capturedAt: Date.now(),
    roots: { '#root': serverHtml },
  };
}

const BARE =
  'Hydration failed because the initial UI does not match what was rendered on the server.';

describe('React\'s bare "hydration failed" message', () => {
  it('adds no empty card next to a concrete mismatch', () => {
    seed('<span>a</span>', '<span>b</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error(BARE));
    controller.inspectNow();

    const ids = onReport.mock.calls.map((c) => c[0].cause.messageId);
    expect(ids).not.toContain('unknown.no-location');
    expect(onReport.mock.calls.map((c) => c[0].client)).toContain('b');
    controller.stop();
  });

  it('adds none even when it arrives before the concrete message', () => {
    // No snapshot: the only concrete signal is the second message.
    document.body.innerHTML = '<div id="root"></div>';
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error(BARE));
    controller.onRecoverableError(
      new Error('Text content did not match. Server: "X" Client: "Y"'),
    );
    controller.inspectNow();

    const ids = onReport.mock.calls.map((c) => c[0].cause.messageId);
    expect(ids).not.toContain('unknown.no-location');
    expect(onReport.mock.calls.map((c) => c[0].client)).toContain('Y');
    controller.stop();
  });

  it('is still reported when it is the only sign of a failure', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error(BARE));
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    const cause = onReport.mock.calls[0]![0].cause;
    expect(cause.messageId).toBe('unknown.no-location');
    expect(cause.explanation).not.toContain('values above');
    controller.stop();
  });

  it('never suppresses a nesting warning, which also names no values', () => {
    seed('<span>a</span>', '<span>b</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(
      new Error(
        'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
      ),
    );
    controller.inspectNow();

    expect(onReport.mock.calls.map((c) => c[0].cause.category)).toContain(
      'invalid-html-nesting',
    );
    controller.stop();
  });
});

describe('the component a stack names', () => {
  it.each([
    ['\n    at span\n    at p\n    at PriceTag\n    at App', 'PriceTag'],
    ['\n    in div (created by Card)\n    in Card', 'Card'],
    ['\n    at p\n    at InnerLayoutRouter\n    at Checkout', 'Checkout'],
    ['\n    at Header (http://localhost:3000/app.js:10:3)', 'Header'],
  ])('%j → %s', (stack, expected) => {
    seed('<span></span>', '<span>client-only</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error('hydration failed'), {
      componentStack: stack,
    });
    controller.inspectNow();
    expect(onReport.mock.calls[0]![0].component).toBe(expected);
    controller.stop();
  });

  it('names no component rather than a DOM tag', () => {
    seed('<span></span>', '<span>client-only</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error('hydration failed'), {
      componentStack: '\n    at span\n    at p\n    at div',
    });
    controller.inspectNow();
    expect(onReport.mock.calls[0]![0].component).toBeUndefined();
    controller.stop();
  });
});

// ---------------------------------------------------------------------------
// Hebrew and Persian.

const HEBREW = /[\u05d0-\u05ea]/;
const PERSIAN = /[\u0600-\u06ff]/;

describe.each([
  ['he', HEBREW, 'אי-התאמה ב-Hydration', 'סגירה', ['שרת', 'לקוח'], 'תיקון:'],
  [
    'fa',
    PERSIAN,
    'ناهمخوانی در Hydration',
    'بستن',
    ['سرور', 'کلاینت'],
    'راه‌حل:',
  ],
] as const)('the %s panel', (lang, script, title, dismiss, labels, fix) => {
  const report = reportFor(text('١٢٣٤', '1234'));

  it('is right-to-left and declared in its language', () => {
    const { panel, destroy } = mount(lang, report);
    expect(panel.getAttribute('dir')).toBe('rtl');
    expect(panel.getAttribute('lang')).toBe(lang);
    destroy();
  });

  it('translates the chrome', () => {
    const { shadow, card, destroy } = mount(lang, report);
    expect(shadow.querySelector('.wh-title')!.textContent).toBe(title);
    expect(shadow.querySelector('.wh-btn')!.textContent).toBe(dismiss);
    expect(
      [...card.querySelectorAll('.wh-label')].map((l) => l.textContent),
    ).toEqual([...labels]);
    expect(card.querySelector('.wh-fix strong')!.textContent).toBe(fix);
    expect(card.querySelector('.wh-cat')!.textContent).toMatch(script);
    destroy();
  });

  it.each(VARIANTS)(`renders %s in ${lang}`, (id, divergence) => {
    const r = reportFor(divergence);
    expect(r.cause.messageId).toBe(id);
    const { card, destroy } = mount(lang, r);
    for (const selector of ['.wh-explain', '.wh-fix > span']) {
      const node = card.querySelector(selector)!;
      expect(node.getAttribute('dir')).toBe('rtl');
      expect(node.textContent).toMatch(script);
      expect(node.textContent).not.toMatch(/\{\w+\}|`/);
    }
    destroy();
  });

  it('can be forced on an English page', () => {
    const { panel, destroy } = mount('en', report, { locale: lang });
    expect(panel.getAttribute('dir')).toBe('rtl');
    expect(panel.getAttribute('lang')).toBe(lang);
    destroy();
  });

  it('covers every message and category', () => {
    expect(Object.keys(OVERLAY_STRINGS[lang].messages).sort()).toEqual(
      Object.keys(EN_MESSAGES).sort(),
    );
    for (const label of Object.values(OVERLAY_STRINGS[lang].categories)) {
      expect(label).toMatch(script);
    }
  });
});

describe('plurals in the scroll hint', () => {
  const hint = (lang: 'he' | 'fa', count: number) =>
    OVERLAY_STRINGS[lang].hint(count);

  it.each([
    [1, 'בעיה אחת'],
    [2, 'שתי בעיות'],
    [4, '4 בעיות'],
    [11, '11 בעיות'],
    [20, '20 בעיות'],
  ])('Hebrew %i', (count, expected) => {
    expect(hint('he', count)).toBe(`↓ ${expected} — גללו כדי לראות הכול`);
  });

  it.each([
    [1, 'یک مشکل'],
    [4, '4 مشکل'],
    [25, '25 مشکل'],
  ])('Persian %i', (count, expected) => {
    expect(hint('fa', count)).toBe(`↓ ${expected} — برای دیدن همه اسکرول کنید`);
  });
});

describe('each script is spelled with its own letters', () => {
  const allText = (lang: 'ar' | 'he' | 'fa'): string => {
    const t = OVERLAY_STRINGS[lang];
    const params = {
      attribute: 'x',
      server: 's',
      client: 'c',
      tag: '<i>',
      added: ['a'],
      removed: ['b'],
    };
    const parts = Object.values(t.messages).flatMap((m) =>
      [m.explanation, m.suggestion].map((tpl) =>
        plainText(renderMessage(tpl, params)),
      ),
    );
    return [
      ...parts,
      ...Object.values(t.categories),
      t.title,
      t.dialogLabel,
      t.dismiss,
      t.dismissLabel,
      t.hintDismissLabel,
      t.server,
      t.client,
      t.fix,
      t.learnMore,
      t.none,
      t.empty,
      t.hint(5),
    ].join('\n');
  };

  it('Persian uses ی and ک, never the Arabic ي and ك', () => {
    const fa = allText('fa');
    expect(fa).not.toMatch(/[\u064a\u0643]/);
    expect(fa).toMatch(/ی/);
    expect(fa).toMatch(/ک/);
  });

  it('Persian joins its prefixes and suffixes with a zero-width non-joiner', () => {
    const fa = allText('fa');
    // «می‌کند», never «می کند» or «میکند».
    expect(fa).toContain('می‌کند');
    expect(fa).not.toMatch(/(?:^|\s)می /);
    expect(fa).toContain('راه‌حل');
  });

  it('Arabic uses ي and ك, never the Persian ی and ک', () => {
    const ar = allText('ar');
    expect(ar).not.toMatch(/[\u06cc\u06a9]/);
  });

  it('Hebrew is written in Hebrew letters', () => {
    expect(allText('he')).toMatch(HEBREW);
    // No Arabic letters. Arabic-Indic digits are allowed: the digit-script
    // explanation shows `٠١٢` on purpose, in every language.
    expect(allText('he')).not.toMatch(
      /[\u0620-\u064a\u066e-\u06d3\u06fa-\u06ff]/,
    );
  });
});
