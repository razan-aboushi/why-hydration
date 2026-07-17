/**
 * The §6 acceptance table, exercised end-to-end through the real diff engine +
 * classifier (jsdom). Each case builds a server snapshot and a divergent live
 * DOM, runs `inspectRoot`, and asserts the produced cause category.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { ReportCollector } from '../src/core/report';
import { inspectRoot, reportFromMessage } from '../src/core/inspect';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

function setSnapshot(selector: string, serverHtml: string): void {
  const snapshot: Snapshot = {
    version: 1,
    capturedAt: Date.now(),
    roots: { [selector]: serverHtml },
  };
  (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = snapshot;
}

/** Build a live root with `clientHtml`, snapshot `serverHtml`, and inspect. */
function runCase(serverHtml: string, clientHtml: string): HydrationReport[] {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'root';
  root.innerHTML = clientHtml;
  document.body.appendChild(root);
  setSnapshot('#root', serverHtml);

  const collector = new ReportCollector();
  inspectRoot(root, collector);
  return [...collector.getReports()];
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
});

describe('§6 acceptance table', () => {
  it('1. Math.random() in render → non-deterministic-value', () => {
    const reports = runCase(
      '<span>0.5488135039273248</span>',
      '<span>0.7151893663724195</span>',
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]!.cause.category).toBe('non-deterministic-value');
  });

  it('2. new Date().toLocaleTimeString() in render → date-time', () => {
    const reports = runCase(
      '<time>10:23:45 AM</time>',
      '<time>10:23:46 AM</time>',
    );
    expect(reports[0]!.cause.category).toBe('date-time');
  });

  it('3. Arabic-Indic vs Latin digits → locale-format', () => {
    const reports = runCase('<span>١٢٣٤</span>', '<span>1234</span>');
    expect(reports[0]!.cause.category).toBe('locale-format');
  });

  it('4. window.innerWidth branching → viewport-branching', () => {
    const reports = runCase(
      '<div><section>desktop</section></div>',
      '<div><aside>mobile</aside></div>',
    );
    expect(reports[0]!.cause.category).toBe('viewport-branching');
  });

  it('5. localStorage read during render → browser-only-api', () => {
    const reports = runCase('<span></span>', '<span>dark</span>');
    expect(reports[0]!.cause.category).toBe('browser-only-api');
  });

  it('6. <p> wrapping <div> → invalid-html-nesting (via React message)', () => {
    // The browser reparents invalid nesting identically on both sides, so the
    // DOM diff can't see it — React's message is the reliable signal.
    document.body.innerHTML = '';
    const collector = new ReportCollector();
    reportFromMessage(
      'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
      collector,
    );
    const reports = collector.getReports();
    expect(reports[0]!.cause.category).toBe('invalid-html-nesting');
  });

  it('7. extension attribute injected before hydration → third-party-dom-mutation', () => {
    const reports = runCase(
      '<div><span>Comment</span></div>',
      '<div><span data-gramm="false">Comment</span></div>',
    );
    expect(reports[0]!.cause.category).toBe('third-party-dom-mutation');
  });

  it('8. correct app (no mismatch) → no report emitted', () => {
    const reports = runCase(
      '<div><span>Hello</span></div>',
      '<div><span>Hello</span></div>',
    );
    expect(reports).toHaveLength(0);
  });
});
