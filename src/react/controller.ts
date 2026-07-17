/**
 * The dev-only controller that wires detection → diff → classify → report.
 *
 * Both `<HydrationInspector>` and `createHydrationInspector()` instantiate one
 * of these. It is intentionally framework-light (no React imports) so it can be
 * unit-tested against jsdom directly.
 */

import { inspectRoot, reportFromMessage } from '../core/inspect';
import { ReportCollector } from '../core/report';
import { DEFAULT_SNAPSHOT_SELECTORS, readSnapshot } from '../core/snapshot';
import { isDev } from '../core/env';
import type {
  Classifier,
  DetectionContext,
  Divergence,
  HydrationReport,
} from '../core/types';
import { createConsoleReporter, installConsoleInterceptor } from './console';
import { createOverlay, type OverlayOptions } from './overlay';

export interface InspectorOptions {
  /** Overlay on (default in dev) / off / configured. */
  overlay?: boolean | OverlayOptions;
  /** Callback for every unique report (pipe to your own logging). */
  onReport?: (report: HydrationReport) => void;
  /** Suppress known-safe mismatches by selector or predicate. */
  ignore?: Array<string | ((node: Element) => boolean)>;
  /** Extra classifiers, run before the built-ins. */
  classify?: Classifier[];
  /** Cap on unique reports. Default 25. */
  maxReports?: number;
  /** Root selectors to inspect. Defaults to the snapshot selectors. */
  roots?: string[];
}

/** Build the collector-level ignore predicate from the public `ignore` option. */
function buildIgnore(
  ignore: InspectorOptions['ignore'],
): ((d: Divergence) => boolean) | undefined {
  if (!ignore || ignore.length === 0) return undefined;
  return (divergence: Divergence): boolean => {
    const node = divergence.element ?? null;
    for (const rule of ignore) {
      if (typeof rule === 'function') {
        if (node && rule(node)) return true;
      } else if (node) {
        try {
          if (node.matches(rule) || node.closest(rule)) return true;
        } catch {
          // Ignore invalid selectors.
        }
      }
    }
    return false;
  };
}

export class InspectorController {
  private readonly collector: ReportCollector;
  private readonly options: InspectorOptions;
  private readonly cleanups: Array<() => void> = [];
  private started = false;
  /**
   * Context (component stack, React message) accumulated from detection signals
   * that fire *before* the deferred DOM diff runs. The diff attaches this to
   * whichever report it produces, so a signal that arrives after the initial
   * diff was scheduled still enriches the report.
   */
  private pendingContext: DetectionContext = {};
  private messageReported = false;

  constructor(options: InspectorOptions = {}) {
    this.options = options;
    this.collector = new ReportCollector({
      maxReports: options.maxReports,
      extra: options.classify,
      ignore: buildIgnore(options.ignore),
    });
  }

  /**
   * Begin detection. **Client-only** and idempotent: it no-ops on the server
   * (no `window`), in production, and on repeat calls. The server guard is
   * important — a provider rendered during dev SSR must not patch the Node
   * `console.error` on every request.
   */
  start(): void {
    if (this.started || !isDev || typeof window === 'undefined') return;
    this.started = true;
    this.pendingContext = {};
    this.messageReported = false;

    // Sink: onReport callback.
    if (this.options.onReport) {
      this.collector.addSink(this.options.onReport);
    }
    // Sink: console reporter (always on in dev).
    this.collector.addSink(createConsoleReporter());
    // Sink: overlay, unless explicitly disabled.
    if (this.options.overlay !== false) {
      const overlayOpts: OverlayOptions =
        typeof this.options.overlay === 'object' ? this.options.overlay : {};
      const handle = createOverlay(overlayOpts);
      this.collector.addSink(handle.push);
      this.cleanups.push(() => handle.destroy());
    }

    // Detection: intercept React's dev hydration warnings (Next fallback).
    // We do NOT report from the message immediately — we let the DOM diff
    // locate the precise divergence first, and only fall back to the message
    // (in inspectAllRoots) if the diff finds nothing. This avoids emitting two
    // reports (message-based + DOM-based) for the same mismatch.
    const restore = installConsoleInterceptor((message) => {
      this.mergeContext({ reactMessage: message });
      this.scheduleInspect();
    });
    this.cleanups.push(restore);

    // Primary path: once the initial hydration commit has painted, diff the
    // server snapshot against the live tree exactly once. We deliberately do
    // NOT keep a standing MutationObserver: the frozen server snapshot is only
    // validly comparable immediately after hydration, so re-diffing later would
    // flag legitimate post-hydration DOM updates as false mismatches. Genuine
    // late mismatches (streaming/Suspense) still arrive via onRecoverableError
    // and the console interceptor, which re-trigger a diff.
    this.scheduleInspect();
  }

  /** The `onRecoverableError` handler for controlled `hydrateRoot` callers. */
  onRecoverableError = (
    error: unknown,
    info?: { componentStack?: string },
  ): void => {
    if (!isDev) return;
    this.mergeContext({
      componentStack: info?.componentStack,
      component: firstComponentFromStack(info?.componentStack),
      reactMessage: error instanceof Error ? error.message : String(error),
    });
    this.scheduleInspect();
  };

  /** Merge a detection signal into the pending context (first value wins). */
  private mergeContext(ctx: DetectionContext): void {
    this.pendingContext = {
      componentStack:
        this.pendingContext.componentStack ?? ctx.componentStack,
      component: this.pendingContext.component ?? ctx.component,
      location: this.pendingContext.location ?? ctx.location,
      reactMessage: this.pendingContext.reactMessage ?? ctx.reactMessage,
    };
  }

  /** Stop detection and remove the overlay. */
  stop(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.started = false;
  }

  /** For tests / programmatic access. */
  getReports(): readonly HydrationReport[] {
    return this.collector.getReports();
  }

  /** Run a diff of all roots synchronously (e.g. after a manual DOM change). */
  inspectNow(context: DetectionContext = {}): void {
    this.mergeContext(context);
    this.inspectAllRoots();
  }

  /** Diff every configured root against its snapshot. */
  private inspectAllRoots(): void {
    if (
      !this.started ||
      typeof document === 'undefined' ||
      this.collector.isFull
    ) {
      return;
    }
    const selectors = this.options.roots ?? snapshotSelectors();
    const seen = new Set<Element>();
    for (const selector of selectors) {
      const root = document.querySelector(selector);
      if (!root || seen.has(root)) continue;
      seen.add(root);
      inspectRoot(root, this.collector, this.pendingContext);
    }

    // Fallback: if the DOM diff located nothing but React told us hydration
    // diverged (e.g. invalid nesting the browser silently repaired, or no
    // snapshot was captured), report from the message. Once only.
    if (
      this.collector.getReports().length === 0 &&
      this.pendingContext.reactMessage &&
      !this.messageReported
    ) {
      this.messageReported = true;
      reportFromMessage(
        this.pendingContext.reactMessage,
        this.collector,
        this.pendingContext,
      );
    }
  }

  private scheduleInspect(): void {
    // Defer to a microtask/rAF so hydration has finished committing.
    const run = () => this.inspectAllRoots();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    } else {
      Promise.resolve().then(run);
    }
  }
}

/** Selectors present in the snapshot, falling back to the defaults. */
function snapshotSelectors(): string[] {
  const snapshot = readSnapshot();
  const keys = snapshot ? Object.keys(snapshot.roots) : [];
  return keys.length > 0 ? keys : [...DEFAULT_SNAPSHOT_SELECTORS];
}

/** Best-effort component name from a React component stack string. */
function firstComponentFromStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const match = /\n?\s*(?:at|in)\s+([A-Za-z0-9_$]+)/.exec(stack);
  return match?.[1];
}
