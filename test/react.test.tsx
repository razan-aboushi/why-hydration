/**
 * Integration tests for the React adapter's controller: overlay rendering,
 * onReport callback, and the console reporter — driven through a real DOM diff.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorController } from '../src/react/controller';
import { createOverlay } from '../src/react/overlay';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

function seed(serverHtml: string, clientHtml: string): HTMLElement {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'root';
  root.innerHTML = clientHtml;
  document.body.appendChild(root);
  const snapshot: Snapshot = {
    version: 1,
    capturedAt: Date.now(),
    roots: { '#root': serverHtml },
  };
  (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = snapshot;
  return root;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.querySelector('#why-hydration-overlay')?.remove();
});

describe('InspectorController', () => {
  it('fires onReport with the classified report', () => {
    seed('<span>0.5488135039273248</span>', '<span>0.7151893663724195</span>');
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].cause.category).toBe(
      'non-deterministic-value',
    );
    controller.stop();
  });

  it('renders an overlay in a shadow-DOM container', () => {
    seed('<span></span>', '<span>client-only</span>');
    const controller = new InspectorController({ overlay: true });
    controller.start();
    controller.inspectNow();

    const host = document.querySelector('#why-hydration-overlay');
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();
    const panelText = host!.shadowRoot!.textContent ?? '';
    expect(panelText).toContain('Browser-only API');
    controller.stop();
  });

  it('overlay is removed on stop()', () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: true });
    controller.start();
    controller.inspectNow();
    expect(document.querySelector('#why-hydration-overlay')).not.toBeNull();
    controller.stop();
    expect(document.querySelector('#why-hydration-overlay')).toBeNull();
  });

  it('respects the ignore selector option', () => {
    const root = seed(
      '<div><span class="safe">a</span></div>',
      '<div><span class="safe">b</span></div>',
    );
    expect(root).toBeTruthy();
    const onReport = vi.fn();
    const controller = new InspectorController({
      onReport,
      overlay: false,
      ignore: ['.safe'],
    });
    controller.start();
    controller.inspectNow();
    expect(onReport).not.toHaveBeenCalled();
    controller.stop();
  });
});

describe('overlay', () => {
  it('does not mount until the first report', () => {
    const overlay = createOverlay();
    expect(document.querySelector('#why-hydration-overlay')).toBeNull();
    overlay.push({
      id: 'x',
      timestamp: 0,
      node: { path: 'body', kind: 'text' },
      server: 'a',
      client: 'b',
      cause: {
        category: 'unknown',
        confidence: 0,
        explanation: 'e',
        suggestion: 's',
      },
    });
    expect(document.querySelector('#why-hydration-overlay')).not.toBeNull();
    overlay.destroy();
  });

  // Regression guard for RTL host pages (<html dir="rtl">). The CSS "all"
  // shorthand deliberately excludes direction/unicode-bidi (CSS spec), so a
  // naive `:host { all: initial }` still leaks direction:rtl into the shadow
  // tree and flips flex/grid order + text alignment — confirmed against a real
  // browser with a live dir="rtl" page. jsdom does not implement shadow-DOM CSS
  // cascade, so it cannot verify the computed style; this asserts the fix is
  // present in the injected stylesheet instead.
  it('shadow stylesheet forces direction:ltr (RTL host page support)', () => {
    const overlay = createOverlay();
    overlay.push({
      id: 'rtl-1',
      timestamp: 0,
      node: { path: 'body', kind: 'text' },
      server: 'a',
      client: 'b',
      cause: {
        category: 'unknown',
        confidence: 0,
        explanation: 'e',
        suggestion: 's',
      },
    });
    const host = document.querySelector('#why-hydration-overlay')!;
    const css = host.shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).toMatch(/:host\s*{[^}]*direction:\s*ltr/);
    expect(css).toMatch(/\.wh-panel\s*{[^}]*direction:\s*ltr/);
    overlay.destroy();
  });
});
