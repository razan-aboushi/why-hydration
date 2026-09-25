/**
 * Options that change after mount, and roots that never match.
 *
 * `<HydrationInspector>` used to read its props once, at mount: changing
 * `overlay`, `onReport`, `ignore`, `classify` or `maxReports` afterwards did
 * nothing until a reload. And a `roots` selector that matched nothing on the
 * page — usually a typo — was skipped without a word.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HydrationInspector } from '../src/react/index';
import { InspectorController } from '../src/react/controller';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type {
  Classifier,
  HydrationReport,
  OverlayOptions,
} from '../src/react/index';

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

const host = () => document.getElementById('why-hydration-overlay');
const panel = () => host()?.shadowRoot?.querySelector('.wh-panel') ?? null;
const cards = () =>
  host()?.shadowRoot?.querySelectorAll('.wh-card').length ?? 0;

let reactRoot: Root | null = null;
let container: HTMLElement | null = null;

type Props = {
  overlay?: boolean | OverlayOptions;
  onReport?: (r: HydrationReport) => void;
  ignore?: Array<string | ((node: Element) => boolean)>;
  classify?: Classifier[];
  maxReports?: number;
};

async function render(props: Props): Promise<void> {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    reactRoot = createRoot(container);
  }
  await React.act(async () => {
    reactRoot!.render(
      <React.StrictMode>
        <HydrationInspector {...props}>
          <span>app</span>
        </HydrationInspector>
      </React.StrictMode>,
    );
  });
}

const settle = () => new Promise((r) => setTimeout(r, 30));

afterEach(async () => {
  if (reactRoot) {
    const r = reactRoot;
    reactRoot = null;
    await React.act(async () => r.unmount());
  }
  container = null;
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('lang');
  host()?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('<HydrationInspector> props that change after mount', () => {
  it('rebuilds the panel in a new language, keeping its reports', async () => {
    seed('<span>a</span>', '<span>b</span>');
    await render({ overlay: { locale: 'en' } });
    await settle();
    expect(panel()!.getAttribute('lang')).toBe('en');
    expect(cards()).toBe(1);

    await render({ overlay: { locale: 'ar' } });
    expect(panel()!.getAttribute('lang')).toBe('ar');
    expect(panel()!.getAttribute('dir')).toBe('rtl');
    // Replayed into the new panel, not lost.
    expect(cards()).toBe(1);
    expect(document.querySelectorAll('#why-hydration-overlay')).toHaveLength(1);
  });

  it('moves the panel when the position changes', async () => {
    seed('<span>a</span>', '<span>b</span>');
    await render({ overlay: { position: 'bottom-right' } });
    await settle();
    expect(panel()!.classList.contains('wh-bottom-right')).toBe(true);

    await render({ overlay: { position: 'top-left' } });
    expect(panel()!.classList.contains('wh-top-left')).toBe(true);
  });

  it('removes and restores the panel when overlay is switched off and on', async () => {
    seed('<span>a</span>', '<span>b</span>');
    await render({ overlay: true });
    await settle();
    expect(host()).not.toBeNull();

    await render({ overlay: false });
    expect(host()).toBeNull();

    await render({ overlay: true });
    expect(cards()).toBe(1);
  });

  it('does not rebuild the panel for an equal, re-created options object', async () => {
    seed('<span>a</span>', '<span>b</span>');
    await render({ overlay: { position: 'top-right' } });
    await settle();
    const before = host();

    // A new object on every render, as inline JSX props are.
    await render({ overlay: { position: 'top-right' } });
    await render({ overlay: { position: 'top-right' } });
    expect(host()).toBe(before);
  });

  it('keeps a dismissed panel dismissed across an unrelated re-render', async () => {
    seed('<span>a</span>', '<span>b</span>');
    await render({ overlay: true, maxReports: 25 });
    await settle();
    host()!.shadowRoot!.querySelector<HTMLButtonElement>('.wh-btn')!.click();
    expect(host()).toBeNull();

    await render({ overlay: true, maxReports: 30 });
    expect(host()).toBeNull();
  });

  it('sends later reports to a new onReport, and not to the old one', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const first = vi.fn();
    const second = vi.fn();
    await render({ overlay: false, onReport: first });
    await settle();
    expect(first).toHaveBeenCalledOnce();

    await render({ overlay: false, onReport: second });
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "X" Client: "Y"',
    );
    await settle();

    expect(second).toHaveBeenCalledOnce();
    expect(second.mock.calls[0]![0].client).toBe('Y');
    // Never replayed the report it had already delivered to `first`.
    expect(first).toHaveBeenCalledOnce();
  });

  it('applies a new ignore list to what is reported next', async () => {
    seed('<p>a</p>', '<p>b</p>');
    const onReport = vi.fn();
    await render({ overlay: false, onReport, ignore: ['p'] });
    await settle();
    expect(onReport).not.toHaveBeenCalled();

    await render({ overlay: false, onReport, ignore: [] });
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "a" Client: "b"',
    );
    await settle();
    expect(onReport).toHaveBeenCalled();
  });

  it('applies new classifiers to what is reported next', async () => {
    seed('<span>same</span>', '<span>same</span>');
    const onReport = vi.fn<(r: HydrationReport) => void>();
    await render({ overlay: false, onReport });
    await settle();

    const custom: Classifier = (d) =>
      d.client === 'Z'
        ? {
            category: 'unknown',
            confidence: 0.99,
            explanation: 'CUSTOM',
            suggestion: 's',
          }
        : null;
    await render({ overlay: false, onReport, classify: [custom] });
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "Q" Client: "Z"',
    );
    await settle();

    expect(onReport.mock.calls.at(-1)![0].cause.explanation).toBe('CUSTOM');
  });

  it('respects a lowered maxReports from then on', async () => {
    seed('<span>same</span>', '<span>same</span>');
    const onReport = vi.fn();
    await render({ overlay: false, onReport, maxReports: 25 });
    await settle();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "1" Client: "2"',
    );
    await settle();
    expect(onReport).toHaveBeenCalledTimes(1);

    await render({ overlay: false, onReport, maxReports: 1 });
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "3" Client: "4"',
    );
    await settle();
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});

describe('a configured root that matches nothing', () => {
  function withRoots(roots: string[]) {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new InspectorController({ overlay: false, roots });
    return { warn, controller };
  }
  const messages = (warn: ReturnType<typeof vi.spyOn>) =>
    warn.mock.calls.map((c) => String(c[0]));

  it('is warned about once, when the settling window closes', () => {
    vi.useFakeTimers();
    seed('<span>a</span>', '<span>a</span>');
    const { warn, controller } = withRoots(['#root', '#typo']);
    controller.start();

    vi.advanceTimersByTime(1000);
    // Not yet: a root may still be rendered during the window.
    expect(messages(warn).filter((m) => m.includes('#typo'))).toEqual([]);

    vi.advanceTimersByTime(600);
    const typo = messages(warn).filter((m) => m.includes('#typo'));
    expect(typo).toHaveLength(1);
    expect(typo[0]).toContain('no element matches "#typo"');
    // The root that exists is never mentioned.
    expect(messages(warn).some((m) => m.includes('"#root"'))).toBe(false);
    controller.stop();
  });

  it('is not warned about if it appears during the window', () => {
    vi.useFakeTimers();
    seed('<span>a</span>', '<span>a</span>');
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY]!.roots[
      '#late'
    ] = '<b>x</b>';
    const { warn, controller } = withRoots(['#late']);
    controller.start();

    vi.advanceTimersByTime(500);
    const late = document.createElement('div');
    late.id = 'late';
    late.innerHTML = '<b>x</b>';
    document.body.appendChild(late);
    vi.advanceTimersByTime(1200);

    expect(messages(warn)).toEqual([]);
    controller.stop();
  });

  it('reports an invalid selector once, not twice', () => {
    vi.useFakeTimers();
    seed('<span>a</span>', '<span>a</span>');
    const { warn, controller } = withRoots(['>>>bad']);
    controller.start();
    vi.advanceTimersByTime(1600);

    const bad = messages(warn).filter((m) => m.includes('>>>bad'));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('not a valid CSS selector');
    controller.stop();
  });

  it('says nothing when roots are not configured', () => {
    vi.useFakeTimers();
    seed('<span>a</span>', '<span>a</span>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new InspectorController({ overlay: false });
    controller.start();
    vi.advanceTimersByTime(1600);
    expect(warn).not.toHaveBeenCalled();
    controller.stop();
  });

  it('says nothing after the inspector was stopped', () => {
    vi.useFakeTimers();
    seed('<span>a</span>', '<span>a</span>');
    const { warn, controller } = withRoots(['#typo']);
    controller.start();
    controller.stop();
    vi.advanceTimersByTime(1600);
    expect(warn).not.toHaveBeenCalled();
  });
});
