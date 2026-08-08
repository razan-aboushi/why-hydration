/**
 * Text direction. The overlay renders English diagnostics with a server/client
 * diff laid out left-to-right, so it must stay LTR even when the host page is
 * RTL — the CSS `all` shorthand deliberately excludes `direction`/`unicode-bidi`
 * (per spec), so `:host { all: initial }` alone still lets `direction: rtl` leak
 * into the shadow tree and flip the diff columns and text alignment.
 *
 * jsdom implements neither the shadow-DOM CSS cascade nor bidi layout, so these
 * assert the guarantees that *are* observable: the `dir` attribute on the host
 * and the rules in the injected stylesheet. The engine itself must stay
 * direction-agnostic and keep reading RTL content correctly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOverlay } from '../src/react/overlay';
import {
  collectSnapshotAgainstDom,
  diffSnapshotAgainstDom,
} from '../src/core/diff';
import { classify } from '../src/core/classify';
import { InspectorController } from '../src/react/controller';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

function report(overrides: Partial<HydrationReport> = {}): HydrationReport {
  return {
    id: 'r1',
    timestamp: 0,
    node: { path: 'body > span', kind: 'text' },
    server: '١٢٣٤',
    client: '1234',
    cause: {
      category: 'locale-format',
      confidence: 0.92,
      explanation: 'Digit scripts differ.',
      suggestion: 'Pass an explicit locale.',
    },
    ...overrides,
  };
}

function client(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

function styleSheet(): string {
  const host = document.getElementById('why-hydration-overlay')!;
  return host.shadowRoot!.querySelector('style')!.textContent ?? '';
}

afterEach(() => {
  resetCapture();
  document.documentElement.removeAttribute('dir');
  document.body.removeAttribute('dir');
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.getElementById('why-hydration-overlay')?.remove();
  document.body.innerHTML = '';
});

describe.each(['rtl', 'ltr'] as const)('overlay on a dir="%s" page', (dir) => {
  it('pins the host element to LTR with an attribute', () => {
    document.documentElement.setAttribute('dir', dir);
    const overlay = createOverlay();
    overlay.push(report());

    // An outer-page rule targeting the host outranks `:host`, but not `dir`.
    const host = document.getElementById('why-hydration-overlay')!;
    expect(host.getAttribute('dir')).toBe('ltr');
    overlay.destroy();
  });

  it('pins the shadow tree to LTR with the injected stylesheet', () => {
    document.documentElement.setAttribute('dir', dir);
    const overlay = createOverlay();
    overlay.push(report());

    const css = styleSheet();
    expect(css).toMatch(/:host\s*{[^}]*direction:\s*ltr/);
    expect(css).toMatch(/:host\s*{[^}]*unicode-bidi:\s*isolate/);
    expect(css).toMatch(/\.wh-panel\s*{[^}]*direction:\s*ltr/);
    expect(css).toMatch(/\.wh-panel\s*{[^}]*text-align:\s*left/);
    overlay.destroy();
  });

  it('renders RTL and LTR report values side by side intact', () => {
    document.documentElement.setAttribute('dir', dir);
    const overlay = createOverlay();
    overlay.push(
      report({ server: 'السعر ١٬٤٠٠ د.ك', client: 'Price 1,400 KWD' }),
    );

    const host = document.getElementById('why-hydration-overlay')!;
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector('.wh-server')!.textContent).toContain(
      'السعر ١٬٤٠٠ د.ك',
    );
    expect(shadow.querySelector('.wh-client')!.textContent).toContain(
      'Price 1,400 KWD',
    );
    overlay.destroy();
  });

  it('escapes report values as text rather than markup', () => {
    document.documentElement.setAttribute('dir', dir);
    const overlay = createOverlay();
    overlay.push(
      report({ server: '<img src=x onerror="boom()">', client: 'ب' }),
    );

    const shadow = document.getElementById(
      'why-hydration-overlay',
    )!.shadowRoot!;
    expect(shadow.querySelector('img')).toBeNull();
    expect(shadow.querySelector('.wh-server')!.textContent).toContain(
      '<img src=x onerror="boom()">',
    );
    overlay.destroy();
  });
});

describe('the diff engine is direction-agnostic', () => {
  it('detects an Arabic-Indic vs Latin digit mismatch as locale-format', () => {
    const d = diffSnapshotAgainstDom(
      '<span>١٢٣٤</span>',
      client('<span>1234</span>'),
    );
    expect(d?.kind).toBe('text');
    expect(classify(d!).category).toBe('locale-format');
  });

  it('reports a server/client dir attribute flip as an attribute mismatch', () => {
    const d = diffSnapshotAgainstDom(
      '<div dir="rtl">مرحبا</div>',
      client('<div dir="ltr">مرحبا</div>'),
    );
    expect(d?.kind).toBe('attribute');
    expect(d?.attribute).toBe('dir');
    expect(classify(d!).category).toBe('attribute-mismatch');
  });

  it('invents no mismatch for identical RTL markup', () => {
    const rtl =
      '<div dir="rtl"><p>مرحبا بالعالم</p><span class="سعر">٤٥٦</span></div>';
    expect(collectSnapshotAgainstDom(rtl, client(rtl))).toEqual([]);
  });

  it('invents no mismatch for identical LTR markup', () => {
    const ltr = '<div dir="ltr"><p>Hello world</p><span>456</span></div>';
    expect(collectSnapshotAgainstDom(ltr, client(ltr))).toEqual([]);
  });

  it('finds a mismatch nested inside an RTL subtree', () => {
    const found = collectSnapshotAgainstDom(
      '<div dir="rtl"><p>مرحبا</p><span>٤٥٦</span></div>',
      client('<div dir="rtl"><p>مرحبا</p><span>٤٥٧</span></div>'),
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.server).toBe('٤٥٦');
    expect(found[0]!.client).toBe('٤٥٧');
  });

  it('treats an RTL class list as an attribute mismatch, not a locale one', () => {
    const d = diffSnapshotAgainstDom(
      '<span class="سعر بارز">١٢٣</span>',
      client('<span class="سعر بارز مخفي">١٢٣</span>'),
    );
    expect(d?.attribute).toBe('class');
    const cause = classify(d!);
    expect(cause.category).toBe('attribute-mismatch');
    expect(cause.explanation).toContain('مخفي');
  });
});

describe('end to end on an RTL page', () => {
  it('reports and renders an Arabic mismatch', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'root';
    root.dir = 'rtl';
    root.innerHTML = '<span>1234</span>';
    document.body.appendChild(root);
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#root': '<span>١٢٣٤</span>' },
    };

    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: true });
    controller.start();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].cause.category).toBe('locale-format');
    const host = document.getElementById('why-hydration-overlay')!;
    expect(host.getAttribute('dir')).toBe('ltr');
    expect(host.shadowRoot!.textContent).toContain('Locale formatting');
    controller.stop();
  });
});
