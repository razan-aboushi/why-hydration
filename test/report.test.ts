import { describe, expect, it, vi } from 'vitest';
import { ReportCollector } from '../src/core/report';
import type { Divergence } from '../src/core/types';

const div = (client: string): Divergence => ({
  kind: 'text',
  path: 'body > span',
  server: '',
  client,
});

describe('ReportCollector', () => {
  it('classifies and dispatches to sinks', () => {
    const sink = vi.fn();
    const c = new ReportCollector();
    c.addSink(sink);
    const report = c.report(div('content'));
    expect(report?.cause.category).toBe('browser-only-api');
    expect(sink).toHaveBeenCalledOnce();
  });

  it('deduplicates identical divergences', () => {
    const c = new ReportCollector();
    c.report(div('content'));
    const second = c.report(div('content'));
    expect(second).toBeNull();
    expect(c.getReports()).toHaveLength(1);
  });

  it('honors maxReports', () => {
    const c = new ReportCollector({ maxReports: 2 });
    c.report(div('a'));
    c.report(div('b'));
    expect(c.report(div('c'))).toBeNull();
    expect(c.getReports()).toHaveLength(2);
  });

  it('applies the ignore predicate', () => {
    const c = new ReportCollector({ ignore: (d) => d.client === 'skip' });
    expect(c.report(div('skip'))).toBeNull();
    expect(c.getReports()).toHaveLength(0);
  });

  it('a throwing sink does not stop other sinks', () => {
    const good = vi.fn();
    const c = new ReportCollector();
    c.addSink(() => {
      throw new Error('bad sink');
    });
    c.addSink(good);
    c.report(div('content'));
    expect(good).toHaveBeenCalledOnce();
  });

  it('reset clears state', () => {
    const c = new ReportCollector();
    c.report(div('content'));
    c.reset();
    expect(c.getReports()).toHaveLength(0);
    // Same divergence reports again after reset.
    expect(c.report(div('content'))).not.toBeNull();
  });
});
