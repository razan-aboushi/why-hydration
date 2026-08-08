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
  if (value.length <= max) return value;
  // Never cut between the halves of a surrogate pair. A lone surrogate is not
  // valid text: it renders as a replacement character in the overlay and can
  // break JSON round-tripping in a user's `onReport` sink. Arabic itself is
  // BMP, but emoji in product copy is not.
  const last = value.charCodeAt(max - 1);
  const end = last >= 0xd800 && last <= 0xdbff ? max - 1 : max;
  return `${value.slice(0, end)}…`;
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

  /**
   * Register a sink. Pass `replay` for sinks that render *state* (the overlay)
   * rather than react to *events* (`onReport`, the console): they need the
   * reports collected before they were attached, which matters when a sink is
   * re-attached after a stop/start cycle.
   */
  addSink(sink: ReportSink, options: { replay?: boolean } = {}): () => void {
    this.sinks.add(sink);
    if (options.replay) {
      for (const report of this.reports) this.emit(sink, report);
    }
    return () => this.sinks.delete(sink);
  }

  private emit(sink: ReportSink, report: HydrationReport): void {
    try {
      sink(report);
    } catch {
      /* a failing sink must not stop the others */
    }
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
    for (const sink of this.sinks) this.emit(sink, report);
    return report;
  }

  reset(): void {
    this.seen.clear();
    this.reports.length = 0;
  }
}
