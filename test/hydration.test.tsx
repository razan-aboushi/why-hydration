/**
 * The real thing: mismatches produced by an actual `hydrateRoot` pass, not a
 * hand-built snapshot. Every other suite feeds the engine a snapshot it wrote
 * itself, which cannot catch the parts that depend on React's real timing —
 * whether capture is installed before React logs, whether the DOM has settled
 * when the diff runs, and what React's warnings actually look like.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { HydrationInspector } from '../src/react/index';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, captureSnapshotNow } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

let reactRoot: Root | null = null;

/**
 * Reproduces the real sequence: the server markup is already in the document,
 * <HydrationSnapshotScript> records it, and only then does React hydrate.
 */
async function hydrate(
  serverHtml: string,
  app: React.ReactNode,
  onReport: (report: HydrationReport) => void,
  { strict = false }: { strict?: boolean } = {},
): Promise<void> {
  const container = document.createElement('div');
  container.id = 'root';
  container.innerHTML = serverHtml;
  document.body.appendChild(container);
  captureSnapshotNow(['#root']);

  const tree = (
    <HydrationInspector overlay={false} onReport={onReport}>
      {app}
    </HydrationInspector>
  );

  await React.act(async () => {
    reactRoot = hydrateRoot(
      container,
      strict ? <React.StrictMode>{tree}</React.StrictMode> : tree,
    );
  });
  await nextFrame();
}

afterEach(async () => {
  if (reactRoot) {
    const current = reactRoot;
    reactRoot = null;
    await React.act(async () => current.unmount());
  }
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
  vi.restoreAllMocks();
});

describe('real hydrateRoot mismatches', () => {
  it('reports a non-deterministic text value', async () => {
    const onReport = vi.fn<(report: HydrationReport) => void>();
    await hydrate(
      '<div><span>0.5488135039273248</span></div>',
      <div>
        <span>0.7151893663724195</span>
      </div>,
      onReport,
    );

    expect(onReport).toHaveBeenCalled();
    const categories = onReport.mock.calls.map((c) => c[0].cause.category);
    expect(categories).toContain('non-deterministic-value');
  });

  it('reports a browser-only value the server left empty', async () => {
    const onReport = vi.fn<(report: HydrationReport) => void>();
    await hydrate(
      '<div><span></span></div>',
      <div>
        <span>{'dark'}</span>
      </div>,
      onReport,
    );

    expect(onReport).toHaveBeenCalled();
    const categories = onReport.mock.calls.map((c) => c[0].cause.category);
    expect(categories).toContain('browser-only-api');
  });

  it('stays silent when hydration is clean', async () => {
    const onReport = vi.fn<(report: HydrationReport) => void>();
    await hydrate(
      '<div><span>stable</span></div>',
      <div>
        <span>stable</span>
      </div>,
      onReport,
    );
    // The settling window re-diffs for 1.5s; give it room to misfire.
    await new Promise((r) => setTimeout(r, 300));

    expect(onReport).not.toHaveBeenCalled();
  });

  it('reports exactly once under Strict Mode', async () => {
    const onReport = vi.fn<(report: HydrationReport) => void>();
    await hydrate(
      '<div><span>0.5488135039273248</span></div>',
      <div>
        <span>0.7151893663724195</span>
      </div>,
      onReport,
      { strict: true },
    );
    await new Promise((r) => setTimeout(r, 300));

    const values = onReport.mock.calls.map(
      (c) => `${c[0].server}->${c[0].client}`,
    );
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain('0.5488135039273248->0.7151893663724195');
  });

  it('renders the overlay for a real mismatch', async () => {
    const container = document.createElement('div');
    container.id = 'root';
    container.innerHTML = '<div><span>١٢٣٤</span></div>';
    document.body.appendChild(container);
    captureSnapshotNow(['#root']);

    await React.act(async () => {
      reactRoot = hydrateRoot(
        container,
        <HydrationInspector>
          <div>
            <span>1234</span>
          </div>
        </HydrationInspector>,
      );
    });
    await nextFrame();

    const host = document.getElementById('why-hydration-overlay');
    expect(host).not.toBeNull();
    expect(host!.getAttribute('dir')).toBe('ltr');
    expect(host!.shadowRoot!.textContent).toContain('Locale formatting');
  });
});
