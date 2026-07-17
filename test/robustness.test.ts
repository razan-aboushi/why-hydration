/**
 * Robustness / false-positive guards. These lock in the review fixes: the diff
 * must ignore the tool's own overlay and framework-injected nodes, locate deep
 * mismatches, and the controller's detection must be client-only and
 * signal-driven.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { diffSnapshotAgainstDom } from '../src/core/diff';
import { InspectorController } from '../src/react/controller';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

function client(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
});

describe('diff ignores non-content noise (no false positives)', () => {
  it('ignores a streaming-SSR <script> injected on the client', () => {
    expect(
      diffSnapshotAgainstDom(
        '<div><span>hi</span></div>',
        client('<div><span>hi</span><script>self.__x=1</script></div>'),
      ),
    ).toBeNull();
  });

  it("ignores the tool's own overlay container", () => {
    expect(
      diffSnapshotAgainstDom(
        '<span>hi</span>',
        client('<span>hi</span><div data-why-hydration="overlay"></div>'),
      ),
    ).toBeNull();
  });

  it('ignores <template> / <style> placeholders', () => {
    expect(
      diffSnapshotAgainstDom(
        '<ul><li>a</li></ul>',
        client('<ul><li>a</li><template></template><style>.x{}</style></ul>'),
      ),
    ).toBeNull();
  });

  it('still finds a real mismatch that sits next to noise', () => {
    const d = diffSnapshotAgainstDom(
      '<div><span>a</span></div>',
      client('<div><span>b</span><script>1</script></div>'),
    );
    expect(d?.kind).toBe('text');
    expect(d?.client).toBe('b');
  });
});

describe('diff locates deep and multi-attribute mismatches', () => {
  it('locates a deeply nested text mismatch', () => {
    const d = diffSnapshotAgainstDom(
      '<div><section><p><span>a</span></p></section></div>',
      client('<div><section><p><span>b</span></p></section></div>'),
    );
    expect(d?.kind).toBe('text');
    expect(d?.path).toContain('span');
  });

  it('reports the first differing attribute, skipping equal ones', () => {
    const d = diffSnapshotAgainstDom(
      '<a href="/x" title="a" rel="noopener">t</a>',
      client('<a href="/x" title="b" rel="noopener">t</a>'),
    );
    expect(d?.kind).toBe('attribute');
    expect(d?.attribute).toBe('title');
  });
});

describe('InspectorController detection is safe and signal-driven', () => {
  function seed(server: string, clientHtml: string): void {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'root';
    root.innerHTML = clientHtml;
    document.body.appendChild(root);
    const snapshot: Snapshot = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#root': server },
    };
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = snapshot;
  }

  const nextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  it('runs a diff on the initial post-hydration frame', async () => {
    seed('<span>0.5488135039273248</span>', '<span>0.7151893663724195</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    await nextFrame();
    expect(onReport).toHaveBeenCalledOnce();
    controller.stop();
  });

  it('re-diffs when onRecoverableError fires', async () => {
    seed('<span></span>', '<span>from-localStorage</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error('Hydration failed'), {
      componentStack: '\n    at Theme\n    at App',
    });
    await nextFrame();
    expect(onReport).toHaveBeenCalled();
    expect(onReport.mock.calls[0]![0].cause.category).toBe('browser-only-api');
    expect(onReport.mock.calls[0]![0].component).toBe('Theme');
    controller.stop();
  });

  it('does not report on a clean page (no false positive)', async () => {
    seed('<span>stable</span>', '<span>stable</span>');
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    await nextFrame();
    expect(onReport).not.toHaveBeenCalled();
    controller.stop();
  });

  it('does not re-mount the overlay after stop()', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: true });
    controller.start();
    controller.stop();
    await nextFrame();
    expect(document.getElementById('why-hydration-overlay')).toBeNull();
  });

  it('falls back to the React console message when there is no snapshot', async () => {
    document.body.innerHTML = '<div id="root"><p>ok</p></div>';
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "A" Client: "B"',
    );
    await nextFrame();
    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].node.kind).toBe('text');
    controller.stop();
  });

  it('reports invalid nesting from the message when the DOM diff is blind', async () => {
    // The browser reparents <div> out of <p> on BOTH sides, so the snapshot and
    // live DOM match and the diff sees nothing — the message is the only signal.
    document.body.innerHTML = '<div id="root"><p></p><div>x</div></div>';
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#root': '<p></p><div>x</div>' },
    };
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
    );
    await nextFrame();
    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].cause.category).toBe(
      'invalid-html-nesting',
    );
    controller.stop();
  });

  it('emits a single report for one mismatch (no message+DOM duplication)', async () => {
    seed('<span>0.5488135039273248</span>', '<span>0.7151893663724195</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // A console warning arrives for the same mismatch the DOM diff will find.
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "0.5488135039273248" Client: "0.7151893663724195"',
    );
    await nextFrame();
    await nextFrame();
    expect(onReport).toHaveBeenCalledOnce();
    controller.stop();
  });
});
