/**
 * Arabic (RTL) and English (LTR), tested as a matched pair.
 *
 * The engine must be direction-agnostic: an Arabic app deserves the same
 * diagnosis quality as an English one, and every rule is written against the
 * *shape* of a value, not its script. Two things make that non-obvious:
 *
 *  - Every numeric/date/time shape test is written in terms of `\d`. An Arabic
 *    app renders Arabic-Indic digits on BOTH sides, so a formatting mismatch
 *    between them is invisible to those tests unless the values are folded to
 *    Latin first. The script-mismatch rule does not cover this — it only fires
 *    when the two sides use *different* scripts.
 *  - `Intl` wraps numbers and dates in bidi control marks in RTL locales, and
 *    different ICU builds (Node vs the browser) emit different ones. That is a
 *    real mismatch whose diff is invisible in both the console and the overlay.
 *
 * Where a case has an English analogue, both are asserted side by side so the
 * two can never drift apart again.
 *
 * `test/direction.test.ts` covers the overlay's own directionality; this file
 * covers detection, classification and the end-to-end path in both languages.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { classify } from '../src/core/classify';
import {
  collectSnapshotAgainstDom,
  diffSnapshotAgainstDom,
} from '../src/core/diff';
import { parseAllHydrationDivergences } from '../src/core/react-message';
import { buildReport } from '../src/core/report';
import { InspectorController } from '../src/react/controller';
import { HydrationInspector } from '../src/react/index';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { Divergence, HydrationReport } from '../src/core/types';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Invisible characters, named so the tests stay readable.
const RLM = '‏';
const LRM = '‎';
const ALM = '؜';

function text(server: string, client: string): Divergence {
  return { kind: 'text', path: 'body > span', server, client };
}

function category(server: string, client: string): string {
  return classify(text(server, client)).category;
}

function client(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

function seed(serverHtml: string, clientHtml: string, dir: string): void {
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'root';
  root.setAttribute('dir', dir);
  root.innerHTML = clientHtml;
  document.body.appendChild(root);
  (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
    version: 1,
    capturedAt: Date.now(),
    roots: { '#root': serverHtml },
  };
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

let reactRoot: Root | null = null;

async function unmount(): Promise<void> {
  if (!reactRoot) return;
  const current = reactRoot;
  reactRoot = null;
  await React.act(async () => current.unmount());
}

afterEach(async () => {
  await unmount();
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
  document.body.removeAttribute('dir');
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('number formatting is classified in both scripts', () => {
  it('classifies a grouping-separator mismatch in Latin digits', () => {
    expect(category('1,234.56', '1.234,56')).toBe('locale-format');
  });

  it('classifies a grouping-separator mismatch in Arabic-Indic digits', () => {
    // Both sides Arabic-Indic: no script mismatch to lean on.
    expect(category('١٬٢٣٤', '١٢٣٤')).toBe('locale-format');
  });

  it('classifies an Arabic decimal separator against an ASCII period', () => {
    expect(category('١٢٣٤٫٥٦', '١٢٣٤.٥٦')).toBe('locale-format');
  });

  it('classifies a Persian-digit grouping mismatch', () => {
    expect(category('۱٬۲۳۴', '۱۲۳۴')).toBe('locale-format');
  });

  it('still reports a cross-script mismatch at the higher confidence', () => {
    const arabicVsLatin = classify(text('١٢٣٤', '1234'));
    expect(arabicVsLatin.category).toBe('locale-format');
    // The script rule is the more specific diagnosis and must keep winning.
    expect(arabicVsLatin.confidence).toBe(0.92);
  });

  it('does not call two genuinely different Arabic numbers a format issue', () => {
    expect(category('١٢٣٤', '٥٦٧٨')).not.toBe('locale-format');
  });

  it('does not call two genuinely different Latin numbers a format issue', () => {
    expect(category('1,234', '9,876')).not.toBe('locale-format');
  });

  it('does not misread an Arabic class list as a number', () => {
    const d: Divergence = {
      kind: 'attribute',
      path: 'body > span',
      attribute: 'class',
      server: 'سعر بارز',
      client: 'سعر بارز مخفي',
    };
    expect(classify(d).category).toBe('attribute-mismatch');
  });
});

describe('dates and times are classified in both scripts', () => {
  it('classifies an English time-of-day drift', () => {
    expect(category('10:30 AM', '11:30 AM')).toBe('date-time');
  });

  it('classifies an Arabic-Indic time-of-day drift', () => {
    expect(category('١٠:٣٠', '١١:٣٠')).toBe('date-time');
  });

  it('classifies a Persian-digit time-of-day drift', () => {
    expect(category('۱۰:۳۰', '۱۱:۳۰')).toBe('date-time');
  });

  it('classifies an Arabic-Indic date field-order flip', () => {
    // English lands on date-time (Date.parse succeeds first); Arabic lands on
    // locale-format. Both name a real cause — what matters is that neither is
    // left unknown.
    expect(category('٢٠٢٤/٠١/٠٢', '٠٢/٠١/٢٠٢٤')).not.toBe('unknown');
  });

  it('classifies an English date field-order flip', () => {
    expect(category('2024/01/02', '02/01/2024')).not.toBe('unknown');
  });
});

describe('invisible bidi marks', () => {
  it('classifies an Arabic date that differs only by an RLM', () => {
    const cause = classify(text('٢٠٢٤/١/٢', `٢٠٢٤/١/٢${RLM}`));
    expect(cause.category).toBe('locale-format');
    expect(cause.explanation).toContain('bidirectional');
  });

  it('classifies an English value that differs only by an LRM', () => {
    expect(category('1/2/2024', `1/2/2024${LRM}`)).toBe('locale-format');
  });

  it('classifies a value differing only by an Arabic letter mark', () => {
    expect(category('١٬٤٠٠ د.ك', `${ALM}١٬٤٠٠ د.ك`)).toBe('locale-format');
  });

  it('classifies a value wrapped in bidi isolates', () => {
    expect(category('السعر ١٢٣', '⁦السعر ١٢٣⁩')).toBe('locale-format');
  });

  it('does not fire when the visible text also differs', () => {
    const cause = classify(text('مرحبا', `أهلا${RLM}`));
    expect(cause.explanation).not.toContain('bidirectional');
  });

  it('does not fire on two values with no marks at all', () => {
    const cause = classify(text('مرحبا', 'أهلا'));
    expect(cause.explanation).not.toContain('bidirectional');
  });

  it('does not fire when both sides are marks only', () => {
    // Nothing visible to diagnose; must not claim a locale cause.
    expect(category(RLM, LRM)).toBe('unknown');
  });
});

describe('the diff engine reads both directions identically', () => {
  it.each([
    ['Arabic', 'مرحبا بالعالم', 'أهلا بالعالم'],
    ['English', 'Hello world', 'Hi world'],
  ])('detects a %s text mismatch', (_lang, server, clientText) => {
    const d = diffSnapshotAgainstDom(
      `<p>${server}</p>`,
      client(`<p>${clientText}</p>`),
    );
    expect(d?.kind).toBe('text');
    expect(d?.server).toBe(server);
    expect(d?.client).toBe(clientText);
  });

  it.each([
    ['Arabic', '<div dir="rtl"><p>مرحبا</p><span>٤٥٦</span></div>'],
    ['English', '<div dir="ltr"><p>Hello</p><span>456</span></div>'],
  ])('invents nothing for identical %s markup', (_lang, html) => {
    expect(collectSnapshotAgainstDom(html, client(html))).toEqual([]);
  });

  it('treats a mixed Arabic/English document as one tree', () => {
    const server =
      '<header dir="rtl"><h1>لوحة التحكم</h1></header>' +
      '<main dir="ltr"><h2>Dashboard</h2><span>1234</span></main>';
    const clientHtml =
      '<header dir="rtl"><h1>لوحة التحكم</h1></header>' +
      '<main dir="ltr"><h2>Dashboard</h2><span>5678</span></main>';
    const found = collectSnapshotAgainstDom(server, client(clientHtml));

    // Only the one changed leaf, in the LTR half, and the RTL half is quiet.
    expect(found).toHaveLength(1);
    expect(found[0]!.server).toBe('1234');
    expect(found[0]!.client).toBe('5678');
  });

  it('finds a mismatch in the RTL half of a mixed document', () => {
    const server =
      '<header dir="rtl"><h1>لوحة التحكم</h1></header><main dir="ltr"><h2>Dashboard</h2></main>';
    const clientHtml =
      '<header dir="rtl"><h1>لوحة الإدارة</h1></header><main dir="ltr"><h2>Dashboard</h2></main>';
    const found = collectSnapshotAgainstDom(server, client(clientHtml));

    expect(found).toHaveLength(1);
    expect(found[0]!.client).toBe('لوحة الإدارة');
  });

  it('reports an RTL-only node the client dropped', () => {
    const found = collectSnapshotAgainstDom(
      '<ul><li>الأول</li><li>الثاني</li></ul>',
      client('<ul><li>الأول</li></ul>'),
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('node-removed');
    expect(found[0]!.server).toContain('الثاني');
  });

  it('aligns children by key when an Arabic node is inserted mid-list', () => {
    const found = collectSnapshotAgainstDom(
      '<ul><li id="a">الأول</li><li id="c">الثالث</li></ul>',
      client(
        '<ul><li id="a">الأول</li><li id="b">الثاني</li><li id="c">الثالث</li></ul>',
      ),
    );
    // One insertion, not a cascade of shifted-sibling false positives.
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('node-added');
  });

  it('normalises an Arabic class list order-independently', () => {
    expect(
      collectSnapshotAgainstDom(
        '<span class="سعر بارز">١٢٣</span>',
        client('<span class="بارز سعر">١٢٣</span>'),
      ),
    ).toEqual([]);
  });

  it.each([
    ['rtl', 'ltr'],
    ['ltr', 'rtl'],
  ])('reports a dir flip from %s to %s', (server, clientDir) => {
    const d = diffSnapshotAgainstDom(
      `<div dir="${server}">نص</div>`,
      client(`<div dir="${clientDir}">نص</div>`),
    );
    expect(d?.kind).toBe('attribute');
    expect(d?.attribute).toBe('dir');
  });

  it('reports Arabic content in a content attribute', () => {
    const d = diffSnapshotAgainstDom(
      '<input placeholder="ابحث هنا">',
      client('<input placeholder="Search here">'),
    );
    expect(d?.kind).toBe('attribute');
    expect(d?.attribute).toBe('placeholder');
    expect(d?.server).toBe('ابحث هنا');
  });
});

describe('React messages carrying Arabic values', () => {
  it('extracts both sides from a modern diff tree', () => {
    const message = [
      "Hydration failed because the server rendered HTML didn't match the client.",
      '  <ProductCard>',
      '    <span>',
      '+     السعر ١٬٤٠٠ د.ك',
      '-     Price 1,400 KWD',
    ].join('\n');
    const found = parseAllHydrationDivergences(message);

    expect(found).toHaveLength(1);
    expect(found[0]!.client).toBe('السعر ١٬٤٠٠ د.ك');
    expect(found[0]!.server).toBe('Price 1,400 KWD');
  });

  it('extracts an Arabic attribute value from a modern diff tree', () => {
    const message = [
      "Hydration failed because the server rendered HTML didn't match the client.",
      '  <div',
      '+   title="لوحة التحكم"',
      '-   title="Dashboard"',
    ].join('\n');
    const found = parseAllHydrationDivergences(message);

    expect(found).toHaveLength(1);
    expect(found[0]!.attribute).toBe('title');
    expect(found[0]!.client).toBe('لوحة التحكم');
  });

  it('extracts Arabic values from the legacy text format', () => {
    const found = parseAllHydrationDivergences(
      'Warning: Text content did not match. Server: "١٢٣٤" Client: "1234"',
    );
    expect(found).toHaveLength(1);
    expect(classify(found[0]!).category).toBe('locale-format');
  });

  it('keeps an RTL attribute that only the server rendered', () => {
    const message = [
      "Hydration failed because the server rendered HTML didn't match the client.",
      '  <div',
      '-   dir="rtl"',
    ].join('\n');
    const found = parseAllHydrationDivergences(message);

    expect(found).toHaveLength(1);
    expect(found[0]!.attribute).toBe('dir');
    expect(found[0]!.server).toBe('rtl');
    expect(found[0]!.client).toBeNull();
  });
});

describe('reports carry both scripts intact', () => {
  it('does not corrupt Arabic when truncating a long value', () => {
    const long = 'م'.repeat(500);
    const report = buildReport(text(long, 'x'), classify(text(long, 'x')));

    expect(report.server).toHaveLength(301); // 300 chars + the ellipsis
    expect(report.server!.endsWith('…')).toBe(true);
    // Every retained character must still be the Arabic letter, not a broken
    // half of one.
    expect(report.server!.slice(0, 300)).toBe('م'.repeat(300));
  });

  it('does not split a surrogate pair when truncating', () => {
    // An emoji is two UTF-16 units, so the leading `x` puts the 300-unit cut
    // squarely between the halves of one. A lone surrogate is not valid text.
    const long = `x${'😀'.repeat(400)}`;
    const report = buildReport(text(long, 'x'), classify(text(long, 'x')));
    const loneSurrogate =
      /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

    expect(report.server!.length).toBeLessThanOrEqual(301);
    expect(report.server).not.toMatch(loneSurrogate);
  });
});

describe('end to end, both directions', () => {
  it.each([
    ['rtl', '<span>١٢٣٤</span>', '<span>1234</span>', 'locale-format'],
    ['ltr', '<span>1,234.56</span>', '<span>1.234,56</span>', 'locale-format'],
  ])(
    'reports a %s page mismatch as %s',
    async (dir, serverHtml, clientHtml, expected) => {
      seed(serverHtml, clientHtml, dir);
      const onReport = vi.fn<(report: HydrationReport) => void>();
      const controller = new InspectorController({ onReport, overlay: true });
      controller.start();
      controller.inspectNow();

      expect(onReport).toHaveBeenCalledOnce();
      expect(onReport.mock.calls[0]![0].cause.category).toBe(expected);

      // The overlay stays LTR whichever way the page runs.
      const host = document.getElementById('why-hydration-overlay')!;
      expect(host.getAttribute('dir')).toBe('ltr');
      controller.stop();
    },
  );

  it.each(['rtl', 'ltr'])(
    'reports through <HydrationInspector> on a dir="%s" page',
    async (dir) => {
      seed('<span>مرحبا</span>', '<span>أهلا</span>', dir);
      const onReport = vi.fn<(report: HydrationReport) => void>();

      const container = document.createElement('div');
      document.body.appendChild(container);
      await React.act(async () => {
        reactRoot = createRoot(container);
        reactRoot.render(
          <React.StrictMode>
            <HydrationInspector overlay={false} onReport={onReport}>
              <span>app</span>
            </HydrationInspector>
          </React.StrictMode>,
        );
      });
      await nextFrame();

      expect(onReport).toHaveBeenCalledTimes(1);
      expect(onReport.mock.calls[0]![0].server).toBe('مرحبا');
      expect(onReport.mock.calls[0]![0].client).toBe('أهلا');
    },
  );

  it('renders Arabic and English values side by side in the overlay', () => {
    seed('<span>السعر ١٬٤٠٠</span>', '<span>Price 1,400</span>', 'rtl');
    const controller = new InspectorController({ overlay: true });
    controller.start();
    controller.inspectNow();

    const shadow = document.getElementById(
      'why-hydration-overlay',
    )!.shadowRoot!;
    expect(shadow.querySelector('.wh-server')!.textContent).toContain(
      'السعر ١٬٤٠٠',
    );
    expect(shadow.querySelector('.wh-client')!.textContent).toContain(
      'Price 1,400',
    );
    controller.stop();
  });

  it('reports an Arabic mismatch found through a React console message', async () => {
    seed('<p>ok</p>', '<p>ok</p>', 'rtl');
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "٢٠٢٤/١/٢" Client: "٢٠٢٤/١/٣"',
    );
    await nextFrame();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].server).toBe('٢٠٢٤/١/٢');
    controller.stop();
  });

  it('inspects an Arabic-id root nested in the captured markup', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.innerHTML = '<div id="تطبيق"><span>الخادم</span></div>';
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { body: '<div id="تطبيق"><span>الخادم</span></div>' },
    };
    document.querySelector('#تطبيق span')!.textContent = 'العميل';

    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({
      onReport,
      overlay: false,
      // Not itself a captured root, so its server markup has to be recovered
      // by locating the Arabic id *inside* the captured `body` — the path that
      // runs the id through CSS escaping.
      roots: ['#تطبيق'],
    });
    controller.start();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].server).toBe('الخادم');
    expect(onReport.mock.calls[0]![0].client).toBe('العميل');
    controller.stop();
  });
});
