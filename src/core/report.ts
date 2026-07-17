/**
 * Report builder + collector.
 *
 * Turns a classified {@link Divergence} into a public {@link HydrationReport},
 * deduplicates identical reports, enforces `maxReports`, and fans each unique
 * report out to registered sinks (overlay, console, `onReport`).
 */

import { classify, type ClassifyOptions } from './classify';
import type {
  Cause,
  DetectionContext,
  Divergence,
  HydrationReport,
} from './types';

/** A sink receives every unique report. */
export type ReportSink = (report: HydrationReport) => void;

let counter = 0;

/** A stable, human-friendly id derived from a monotonic counter + time. */
function nextId(): string {
  counter += 1;
  return `wh_${Date.now().toString(36)}_${counter}`;
}

/** Truncate long values so console/overlay stay readable. */
function truncate(value: string | null, max = 300): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Build a full report from a divergence + classification + detection context. */
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
    raw: context.reactMessage ? { reactMessage: context.reactMessage } : undefined,
  };
}

/**
 * A signature used for deduplication. Two mismatches with the same location,
 * kind, and values are the "same" report even across re-renders.
 */
export function signatureOf(report: HydrationReport): string {
  return [
    report.node.kind,
    report.node.path,
    report.node.attribute ?? '',
    report.cause.category,
    report.server ?? '',
    report.client ?? '',
  ].join('|');
}

export interface CollectorOptions extends ClassifyOptions {
  /** Cap on the number of unique reports emitted. Default 25. */
  maxReports?: number;
  /**
   * Predicate suppressing known-safe divergences before they are reported.
   * Receives the divergence; return `true` to drop it.
   */
  ignore?: (divergence: Divergence) => boolean;
}

/**
 * Collects divergences, classifies + deduplicates them, and dispatches unique
 * reports to its sinks. Framework-agnostic: the React and Next adapters wire
 * their overlay/console sinks into an instance of this.
 */
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

  /** Register a sink. Returns an unsubscribe function. */
  addSink(sink: ReportSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  /** All unique reports emitted so far (for overlay re-render / inspection). */
  getReports(): readonly HydrationReport[] {
    return this.reports;
  }

  /** Whether the cap has been reached. */
  get isFull(): boolean {
    return this.reports.length >= this.maxReports;
  }

  /**
   * Ingest a divergence: classify, dedupe, cap, and dispatch. Returns the
   * emitted report, or `null` if it was ignored, duplicate, or over the cap.
   */
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
        // A failing sink must not stop the others.
      }
    }
    return report;
  }

  /** Clear all state (used by the overlay's "clear" action and tests). */
  reset(): void {
    this.seen.clear();
    this.reports.length = 0;
  }
}
