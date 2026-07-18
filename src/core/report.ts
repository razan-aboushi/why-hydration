import { classify, type ClassifyOptions } from './classify';
import type {
  Cause,
  DetectionContext,
  Divergence,
  HydrationReport,
} from './types';

export type ReportSink = (report: HydrationReport) => void;

let counter = 0;

function nextId(): string {
  counter += 1;
  return `wh_${Date.now().toString(36)}_${counter}`;
}

function truncate(value: string | null, max = 300): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function buildReport(
  divergence: Divergence,
  cause: Cause,
  context: DetectionContext = {},
): HydrationReport {
  return {
    id: nextId(),
    timestamp: Date.now(),
    component: context.component,
    componentStack: context.componentStack,
    location: context.location,
    node: {
      path: divergence.path,
      tagName: divergence.tagName,
      attribute: divergence.attribute,
      kind: divergence.kind,
    },
    server: truncate(divergence.server),
    client: truncate(divergence.client),
    cause,
    raw: context.reactMessage
      ? { reactMessage: context.reactMessage }
      : undefined,
  };
}

// Deduplicate by the *values* of the mismatch, not the DOM path. The same
// mismatch is often reported twice — once from React's console message (path
// `body`) and once from the DOM diff (a precise selector path) — and those must
// collapse into one report.
export function signatureOf(report: HydrationReport): string {
  return [
    report.node.kind,
    report.node.attribute ?? '',
    report.cause.category,
    report.server ?? '',
    report.client ?? '',
  ].join('|');
}

export interface CollectorOptions extends ClassifyOptions {
  maxReports?: number;
  ignore?: (divergence: Divergence) => boolean;
}

export class ReportCollector {
  private readonly seen = new Set<string>();
  private readonly sinks = new Set<ReportSink>();
  private readonly reports: HydrationReport[] = [];
  private readonly maxReports: number;
  private readonly options: CollectorOptions;

  constructor(options: CollectorOptions = {}) {
    this.options = options;
    this.maxReports = options.maxReports ?? 25;
  }

  addSink(sink: ReportSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  getReports(): readonly HydrationReport[] {
    return this.reports;
  }

  get isFull(): boolean {
    return this.reports.length >= this.maxReports;
  }

  report(
    divergence: Divergence,
    context: DetectionContext = {},
  ): HydrationReport | null {
    if (this.isFull) return null;
    if (this.options.ignore?.(divergence)) return null;

    const cause = classify(divergence, {
      extra: this.options.extra,
      threshold: this.options.threshold,
    });
    const report = buildReport(divergence, cause, context);
    const signature = signatureOf(report);
    if (this.seen.has(signature)) return null;

    this.seen.add(signature);
    this.reports.push(report);
    for (const sink of this.sinks) {
      try {
        sink(report);
      } catch {
        /* a failing sink must not stop the others */
      }
    }
    return report;
  }

  reset(): void {
    this.seen.clear();
    this.reports.length = 0;
  }
}
