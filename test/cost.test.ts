/**
 * Detection cost.
 *
 * Detection runs in the browser's main thread during hydration — the single
 * busiest moment of a page load — so its cost is a correctness property, not a
 * nicety. Two things dominate it and both used to be unbounded:
 *
 *  1. How many inspection passes a burst of React messages triggers. A pass is
 *     a full tree diff of every root, and a message burst (React logs several
 *     at once, and a subscribing controller is handed the entire backlog at
 *     once) used to queue one pass per message.
 *  2. How often the captured server markup is re-parsed. Re-materialising it is
 *     a full HTML parse of the server render, and the settling window asks for
 *     it repeatedly even though it never changes.
 *
 * These assert the bounds directly rather than wall-clock timings, which are
 * too machine-dependent to gate a build on.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorController } from '../src/react/controller';
import { MAX_CAPTURED, resetCapture } from '../src/react/capture';
import {
  SNAPSHOT_KEY,
  captureSnapshotNow,
  type Snapshot,
} from '../src/core/snapshot';

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

/** Counts inspection passes — each one is a full diff of every root. */
function countPasses(): { calls: () => number; restore: () => void } {
  const proto = InspectorController.prototype as unknown as {
    inspectAllRoots: () => void;
  };
  const spy = vi.spyOn(proto, 'inspectAllRoots');
  return {
    calls: () => spy.mock.calls.length,
    restore: () => spy.mockRestore(),
  };
}

/** Counts full HTML parses of captured server markup. */
function countParses(): { calls: () => number } {
  const spy = vi.spyOn(document.implementation, 'createHTMLDocument');
  return { calls: () => spy.mock.calls.length };
}

const rows = (n: number): string =>
  Array.from(
    { length: n },
    (_, i) =>
      `<li class="row r${i}"><a href="/x/${i}"><span>item ${i}</span></a></li>`,
  ).join('');

afterEach(() => {
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
  vi.restoreAllMocks();
});

describe('inspection passes are coalesced', () => {
  it('collapses a burst of messages into a single pass per frame', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: false });
    controller.start();

    const passes = countPasses();
    for (let i = 0; i < 25; i++) {
      // eslint-disable-next-line no-console
      console.error(`Warning: hydration failed — variant ${i}`);
    }
    await nextFrame();
    await nextFrame();

    // One pass, not one per message. Every message lands before the frame
    // runs, so a single diff sees exactly the DOM 25 diffs would have.
    expect(passes.calls()).toBe(1);
    passes.restore();
    controller.stop();
  });

  it('still inspects again for a message that arrives in a later frame', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: false });
    controller.start();

    const passes = countPasses();
    // eslint-disable-next-line no-console
    console.error('Warning: hydration failed — first');
    await nextFrame();
    await nextFrame();
    // eslint-disable-next-line no-console
    console.error('Warning: hydration failed — second');
    await nextFrame();
    await nextFrame();

    // Coalescing must not swallow a genuinely later signal.
    expect(passes.calls()).toBe(2);
    passes.restore();
    controller.stop();
  });

  it('reports every distinct mismatch from a coalesced burst', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();

    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "X" Client: "Y"',
    );
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Prop `className` did not match. Server: "p" Client: "q"',
    );
    await nextFrame();
    await nextFrame();

    // Fewer passes must not mean fewer findings: one pass drains every
    // message, so both mismatches plus the DOM one are still reported.
    const values = onReport.mock.calls.map((call) => call[0].client);
    expect(values).toContain('Y');
    expect(values).toContain('q');
    expect(values).toContain('b');
    controller.stop();
  });
});

/**
 * A hidden page suspends `requestAnimationFrame` outright — a tab opened in the
 * background hydrates, mismatches, and never paints a frame. Coalescing behind
 * a latch that only a frame can clear turned that into a permanent shutdown:
 * the first signal set the latch and every later one was dropped.
 */
describe('scheduling survives a suspended requestAnimationFrame', () => {
  const suspendFrames = (): (() => void) => {
    const original = globalThis.requestAnimationFrame;
    // Accepts the callback and never calls it, exactly like a hidden page.
    globalThis.requestAnimationFrame = (() => 0) as typeof original;
    return () => {
      globalThis.requestAnimationFrame = original;
    };
  };

  const settle = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 120));

  it('still inspects when no frame ever arrives', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const restore = suspendFrames();
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();

    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "X" Client: "Y"',
    );
    await settle();

    const values = onReport.mock.calls.map((call) => call[0].client);
    expect(values).toContain('Y');
    restore();
    controller.stop();
  });

  it('is not latched shut by an earlier frame that never fired', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const restore = suspendFrames();
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();

    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "1" Client: "2"',
    );
    await settle();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "3" Client: "4"',
    );
    await settle();

    // The second signal must land too — this is the case the latch swallowed.
    const values = onReport.mock.calls.map((call) => call[0].client);
    expect(values).toContain('2');
    expect(values).toContain('4');
    restore();
    controller.stop();
  });

  it('clears the latch on stop so a restart still schedules', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const restore = suspendFrames();
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });

    controller.start();
    controller.stop();
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "P" Client: "Q"',
    );
    await settle();

    const values = onReport.mock.calls.map((call) => call[0].client);
    expect(values).toContain('Q');
    restore();
    controller.stop();
  });

  it('leaves no timer pending after stop', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const restore = suspendFrames();
    const controller = new InspectorController({ overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    console.error('Warning: hydration failed');

    const passes = countPasses();
    controller.stop();
    await settle();

    // A fallback timer that outlived the stop would diff a torn-down page.
    expect(passes.calls()).toBe(0);
    passes.restore();
    restore();
  });
});

describe('captured server markup is parsed once', () => {
  it('does not re-parse across repeated inspections of the same root', () => {
    document.body.innerHTML = `<div id="root"><ul>${rows(200)}</ul></div>`;
    captureSnapshotNow(['#root']);
    document.querySelector('#root span')!.textContent = 'changed';

    const controller = new InspectorController({ overlay: false });
    controller.start();
    const parses = countParses();
    controller.inspectNow();
    controller.inspectNow();
    controller.inspectNow();

    // The settling window runs several passes against markup that by
    // definition cannot change. One parse serves all of them.
    expect(parses.calls()).toBe(1);
    controller.stop();
  });

  it('does not re-parse when resolving a root nested in the captured markup', () => {
    document.body.innerHTML = `<div id="app"><ul>${rows(200)}</ul></div>`;
    captureSnapshotNow(['body']);
    document.querySelector('#app span')!.textContent = 'changed';

    const controller = new InspectorController({
      overlay: false,
      roots: ['#app'],
    });
    controller.start();
    const parses = countParses();
    controller.inspectNow();
    controller.inspectNow();
    controller.inspectNow();

    // Locating `#app` inside the captured `body` is itself a parse, and the
    // controller asks for the root's HTML twice per pass (once to warn, once
    // to diff). Three passes must still cost one parse each, not six.
    expect(parses.calls()).toBeLessThanOrEqual(2);
    controller.stop();
  });

  it('re-parses when the snapshot is replaced', () => {
    seed(`<ul>${rows(20)}</ul>`, `<ul>${rows(20)}</ul>`);
    const controller = new InspectorController({ overlay: false });
    controller.start();
    const parses = countParses();
    controller.inspectNow();
    const first = parses.calls();

    // A fresh capture (hot reload, a second snapshot) must not be served the
    // tree parsed from the old one.
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#root': '<span>different</span>' },
    };
    controller.inspectNow();
    expect(parses.calls()).toBeGreaterThan(first);
    controller.stop();
  });

  it('still finds the mismatch it would have found without the cache', () => {
    seed('<span>server</span>', '<span>client</span>');
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.inspectNow();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].server).toBe('server');
    expect(onReport.mock.calls[0]![0].client).toBe('client');
    controller.stop();
  });

  it('sees DOM changes made between passes', () => {
    seed('<span>server</span>', '<span>server</span>');
    const onReport = vi.fn();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.inspectNow();
    expect(onReport).not.toHaveBeenCalled();

    // The *server* side is cached; the live DOM must still be re-read, which
    // is the whole point of the settling window.
    document.querySelector('#root span')!.textContent = 'patched-by-react';
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].client).toBe('patched-by-react');
    controller.stop();
  });
});

describe('retained state stays bounded', () => {
  it('keeps at most MAX_CAPTURED messages however many arrive', () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: false });
    controller.start();
    for (let i = 0; i < MAX_CAPTURED * 6; i++) {
      // eslint-disable-next-line no-console
      console.error(`Warning: hydration failed — loop ${i}`);
    }

    // Every retained message is re-parsed on every pass, so an app erroring in
    // a loop must not be able to grow the per-pass cost without limit.
    const messages = (controller as unknown as { messages: Set<string> })
      .messages;
    expect(messages.size).toBe(MAX_CAPTURED);
    controller.stop();
  });

  it('bounds messages fed straight through onRecoverableError', () => {
    seed('<span>a</span>', '<span>b</span>');
    const controller = new InspectorController({ overlay: false });
    controller.start();
    for (let i = 0; i < MAX_CAPTURED * 6; i++) {
      controller.onRecoverableError(new Error(`hydration failed ${i}`));
    }

    const messages = (controller as unknown as { messages: Set<string> })
      .messages;
    expect(messages.size).toBe(MAX_CAPTURED);
    controller.stop();
  });

  it('never exceeds maxReports', () => {
    const cells = Array.from(
      { length: 40 },
      (_, i) => `<span>server-${i}</span>`,
    ).join('');
    const clientCells = Array.from(
      { length: 40 },
      (_, i) => `<span>client-${i}</span>`,
    ).join('');
    seed(cells, clientCells);

    const onReport = vi.fn();
    const controller = new InspectorController({
      onReport,
      overlay: false,
      maxReports: 5,
    });
    controller.start();
    controller.inspectNow();
    controller.inspectNow();

    expect(onReport.mock.calls.length).toBeLessThanOrEqual(5);
    expect(controller.getReports().length).toBeLessThanOrEqual(5);
    controller.stop();
  });
});
