/**
 * An attribute mismatch through a real `hydrateRoot`.
 *
 * This case only works via React's console message: React warns about a
 * mismatched attribute but leaves the *server* value in the DOM, so the
 * snapshot and the live DOM agree and the diff engine is blind to it. It is
 * also the case the README leads with (a conditional `className`).
 *
 * It lives in its own file on purpose. `didWarnInvalidHydration` is a
 * module-level flag in react-dom, so React emits exactly one hydration warning
 * per module instance — and Vitest gives each test *file* its own. Any earlier
 * hydration in the same file would consume the one warning this test needs.
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

let reactRoot: Root | null = null;

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
});

describe('attribute mismatch through real hydration', () => {
  it('reports the className React never patches into the DOM', async () => {
    const container = document.createElement('div');
    container.id = 'root';
    container.innerHTML = '<div class="price">10</div>';
    document.body.appendChild(container);
    captureSnapshotNow(['#root']);

    const onReport = vi.fn<(report: HydrationReport) => void>();
    await React.act(async () => {
      reactRoot = hydrateRoot(
        container,
        <HydrationInspector overlay={false} onReport={onReport}>
          <div className="price forceHide">10</div>
        </HydrationInspector>,
      );
    });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    // React left `class="price"` in the DOM, so this can only have come from
    // parsing its warning.
    expect(container.firstElementChild!.className).toBe('price');

    const report = onReport.mock.calls
      .map((call) => call[0])
      .find((r) => r.node.attribute === 'className');
    expect(report).toBeDefined();
    expect(report!.server).toBe('price');
    expect(report!.client).toBe('price forceHide');
    expect(report!.cause.category).toBe('attribute-mismatch');
    expect(report!.cause.explanation).toContain('forceHide');
  });
});
