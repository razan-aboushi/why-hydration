/**
 * What context a report is allowed to carry, and which roots get inspected.
 *
 * React logs one console message per mismatched node while the DOM diff finds
 * nodes independently, so a message must never be stamped onto divergences it
 * does not describe — that used to relabel unrelated nodes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorController } from '../src/react/controller';
import { ReportCollector } from '../src/core/report';
import { reportFromMessage } from '../src/core/inspect';
import { resetCapture } from '../src/react/capture';
import {
  SNAPSHOT_KEY,
  captureSnapshotNow,
  type Snapshot,
} from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

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

const categories = (
  fn: ReturnType<typeof vi.fn<(report: HydrationReport) => void>>,
): string[] => fn.mock.calls.map((call) => call[0].cause.category);

afterEach(() => {
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
  vi.restoreAllMocks();
});

describe('report attribution', () => {
  it('an unrelated nesting warning does not relabel a DOM divergence', async () => {
    seed(
      '<div><section>desktop</section></div>',
      '<div><aside>mobile</aside></div>',
    );
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // A nesting complaint about a <p> elsewhere on the page.
    // eslint-disable-next-line no-console
    console.error(
      'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
    );
    await nextFrame();

    // The structural swap the diff found is still its own cause, and the
    // message is still reported separately.
    expect(categories(onReport)).toContain('viewport-branching');
    expect(categories(onReport)).toContain('invalid-html-nesting');
    controller.stop();
  });

  it('does not attach an unrelated message to a DOM report', async () => {
    seed('<span>a</span>', '<span>b</span>');
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // eslint-disable-next-line no-console
    console.error(
      'Warning: Text content did not match. Server: "X" Client: "Y"',
    );
    await nextFrame();

    const fromDom = onReport.mock.calls
      .map((call) => call[0])
      .find((report) => report.client === 'b');
    expect(fromDom).toBeDefined();
    expect(fromDom!.raw).toBeUndefined();
    controller.stop();
  });

  it('a later hydration error replaces the stale component context', () => {
    seed('<span></span>', '<span>from-localStorage</span>');
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error('first'), {
      componentStack: '\n    at Alpha\n    at App',
    });
    controller.onRecoverableError(new Error('second'), {
      componentStack: '\n    at Beta\n    at App',
    });
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].component).toBe('Beta');
    controller.stop();
  });

  it('keeps context fields the newer signal does not carry', () => {
    seed('<span></span>', '<span>x</span>');
    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    controller.onRecoverableError(new Error('boom'), {
      componentStack: '\n    at Alpha\n    at App',
    });
    controller.inspectNow({ location: { file: '/src/Alpha.tsx', line: 12 } });

    expect(onReport.mock.calls[0]![0].component).toBe('Alpha');
    expect(onReport.mock.calls[0]![0].location?.file).toBe('/src/Alpha.tsx');
    controller.stop();
  });
});

describe('evidence-free messages', () => {
  // React emits several follow-ups per mismatch that describe the consequence
  // rather than the divergence. They parse to a divergence with no values, no
  // tag and no attribute, and used to render an empty "Unknown — (none)/(none)"
  // card right next to the real diagnosis.
  it.each([
    'Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>.',
    'Error: Text content does not match server-rendered HTML.',
    'Error: There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.',
  ])('produces no report for %#', (message) => {
    const collector = new ReportCollector();
    expect(reportFromMessage(message, collector)).toBe(0);
    expect(collector.getReports()).toHaveLength(0);
  });

  it('still reports a message that does carry values', () => {
    const collector = new ReportCollector();
    expect(
      reportFromMessage(
        'Warning: Text content did not match. Server: "A" Client: "B"\n    at span',
        collector,
      ),
    ).toBe(1);
  });

  it('still reports invalid nesting, which has tags but no values', () => {
    const collector = new ReportCollector();
    expect(
      reportFromMessage(
        'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
        collector,
      ),
    ).toBe(1);
    expect(collector.getReports()[0]!.cause.category).toBe(
      'invalid-html-nesting',
    );
  });
});

describe('custom roots', () => {
  it('inspects a root nested inside the captured snapshot root', () => {
    document.body.innerHTML = '<div id="app"><span>server</span></div>';
    captureSnapshotNow(['body']);
    document.querySelector('#app span')!.textContent = 'client';

    const onReport = vi.fn<(report: HydrationReport) => void>();
    const controller = new InspectorController({
      onReport,
      overlay: false,
      roots: ['#app'],
    });
    controller.start();
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].server).toBe('server');
    expect(onReport.mock.calls[0]![0].client).toBe('client');
    controller.stop();
  });

  it('warns once for a configured root with no captured server HTML', () => {
    document.body.innerHTML = '<div class="app"><span>x</span></div>';
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#elsewhere': '<span>x</span>' },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = new InspectorController({
      overlay: false,
      roots: ['.app'],
    });
    controller.start();
    controller.inspectNow();
    controller.inspectNow();

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('.app');
    controller.stop();
  });

  it('warns instead of throwing on an invalid root selector', () => {
    seed('<span>a</span>', '<span>b</span>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onReport = vi.fn();

    const controller = new InspectorController({
      onReport,
      overlay: false,
      roots: ['>>>bad', '#root'],
    });
    controller.start();
    expect(() => controller.inspectNow()).not.toThrow();

    expect(warn).toHaveBeenCalledOnce();
    // The valid root alongside it is still inspected.
    expect(onReport).toHaveBeenCalledOnce();
    controller.stop();
  });
});
