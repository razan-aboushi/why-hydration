/**
 * Start/stop lifecycle.
 *
 * React Strict Mode invokes a component's render twice on mount and hands each
 * pass *fresh hook state*, so anything created lazily in render is created
 * twice while only the second copy is ever committed. Starting the inspector
 * that way abandoned the first one, still holding the console, its settling
 * timers and its overlay. Only the console capture may happen during render —
 * it is module-scoped and idempotent — and the controller belongs to the
 * effect, whose setup/cleanup React keeps symmetrical.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HydrationInspector } from '../src/react/index';
import { InspectorController } from '../src/react/controller';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

const cards = (): number => {
  const host = document.getElementById('why-hydration-overlay');
  return host?.shadowRoot?.querySelectorAll('.wh-card').length ?? 0;
};

let reactRoot: Root | null = null;

async function mountStrict(node: React.ReactNode): Promise<void> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await React.act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(<React.StrictMode>{node}</React.StrictMode>);
  });
}

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
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
});

describe('<HydrationInspector> under Strict Mode', () => {
  it('reports a mismatch exactly once', async () => {
    seed('<span>0.5488135039273248</span>', '<span>0.7151893663724195</span>');
    const onReport = vi.fn<(report: HydrationReport) => void>();

    await mountStrict(
      <HydrationInspector overlay={false} onReport={onReport}>
        <span>app</span>
      </HydrationInspector>,
    );
    await nextFrame();

    // Two would mean the throwaway render-phase controller is still alive.
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0]![0].cause.category).toBe(
      'non-deterministic-value',
    );
  });

  it('mounts exactly one overlay', async () => {
    seed('<span>a</span>', '<span>b</span>');

    await mountStrict(
      <HydrationInspector>
        <span>app</span>
      </HydrationInspector>,
    );
    await nextFrame();

    expect(document.querySelectorAll('#why-hydration-overlay')).toHaveLength(1);
    expect(cards()).toBe(1);
  });

  it('catches what React logs before the mount effect runs', async () => {
    // A child logging during its own render stands in for React reporting a
    // mismatch mid-hydration: after the inspector renders, before effects run.
    document.body.innerHTML = '<div id="root"><p>ok</p></div>';
    const onReport = vi.fn<(report: HydrationReport) => void>();

    function Mismatch(): React.ReactElement {
      // eslint-disable-next-line no-console
      console.error(
        'Warning: Text content did not match. Server: "A" Client: "B"',
      );
      return <span>x</span>;
    }

    await mountStrict(
      <HydrationInspector overlay={false} onReport={onReport}>
        <Mismatch />
      </HydrationInspector>,
    );
    await nextFrame();

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0]![0].node.kind).toBe('text');
  });

  it('releases the overlay and the console when the tree unmounts', async () => {
    // eslint-disable-next-line no-console
    const original = console.error;
    seed('<span>a</span>', '<span>b</span>');

    await mountStrict(
      <HydrationInspector>
        <span>app</span>
      </HydrationInspector>,
    );
    await nextFrame();
    expect(document.getElementById('why-hydration-overlay')).not.toBeNull();

    await unmount();
    await nextFrame();

    expect(document.getElementById('why-hydration-overlay')).toBeNull();
    // eslint-disable-next-line no-console
    expect(console.error).toBe(original);
  });
});

describe('InspectorController restart', () => {
  it('attaches each sink exactly once across a stop/start cycle', () => {
    seed('<span>a</span>', '<span>b</span>');
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.stop();
    controller.start();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('repopulates a fresh overlay with the reports collected before it', () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: true });
    controller.start();
    controller.inspectNow();
    expect(cards()).toBe(1);

    controller.stop();
    expect(document.getElementById('why-hydration-overlay')).toBeNull();

    controller.start();
    expect(cards()).toBe(1);
    controller.stop();
  });

  it('does not replay past reports to onReport', () => {
    seed('<span>a</span>', '<span>b</span>');
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: true });
    controller.start();
    controller.inspectNow();
    expect(onReport).toHaveBeenCalledTimes(1);

    // The overlay is state and gets replayed; onReport is an event and must
    // not fire twice for a mismatch the caller already saw.
    controller.stop();
    controller.start();
    expect(onReport).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('re-installs the console interceptor', async () => {
    document.body.innerHTML = '<div id="root"><p>ok</p></div>';
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.stop();
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "A" Client: "B"',
    );
    await nextFrame();

    expect(onReport).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('leaves console.error exactly as it found it', () => {
    // eslint-disable-next-line no-console
    const original = console.error;
    const controller = new InspectorController({ overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    expect(console.error).not.toBe(original);

    controller.stop();
    // A bound copy here instead of the original would stack another wrapper on
    // every start/stop cycle.
    // eslint-disable-next-line no-console
    expect(console.error).toBe(original);
  });

  it('still sees messages captured before the restart', () => {
    document.body.innerHTML = '<div id="root"><p>ok</p></div>';
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "A" Client: "B"',
    );
    controller.stop();
    controller.start();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledTimes(1);
    controller.stop();
  });
});
