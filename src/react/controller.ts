import { inspectRoot, reportFromMessage } from '../core/inspect';
import { isInternalComponent } from '../core/react-message';
import { ReportCollector } from '../core/report';
import {
  DEFAULT_SNAPSHOT_SELECTORS,
  getServerHtmlForRoot,
  readSnapshot,
} from '../core/snapshot';
import { isDev } from '../core/env';
import type {
  Classifier,
  DetectionContext,
  Divergence,
  HydrationReport,
} from '../core/types';
import { MAX_CAPTURED, subscribeCapture } from './capture';
import { createConsoleReporter } from './console';
import { createOverlay, type OverlayOptions } from './overlay';
import { resolveReactSource } from './fiber';

const INSPECT_FALLBACK_MS = 50;

export interface InspectorOptions {
  overlay?: boolean | OverlayOptions;
  onReport?: (report: HydrationReport) => void;
  ignore?: Array<string | ((node: Element) => boolean)>;
  classify?: Classifier[];
  maxReports?: number;
  roots?: string[];
}

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
          /* invalid selector */
        }
      }
    }
    return false;
  };
}

export class InspectorController {
  private readonly collector: ReportCollector;
  private options: InspectorOptions;
  private overlayTeardown: (() => void) | null = null;
  private readonly matchedRoots = new Set<string>();
  private readonly cleanups: Array<() => void> = [];
  private started = false;
  private pendingContext: DetectionContext = {};
  private readonly messages = new Set<string>();
  private readonly warnedRoots = new Set<string>();
  private settlingTimers: Array<ReturnType<typeof setTimeout>> = [];
  private inspectScheduled = false;
  private inspectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: InspectorOptions = {}) {
    this.options = options;
    this.collector = new ReportCollector({
      maxReports: options.maxReports,
      extra: options.classify,
      ignore: buildIgnore(options?.ignore),
    });
  }

  start(): void {
    if (this.started || !isDev || typeof window === 'undefined') return;
    this.started = true;

    // Forwarded rather than registered directly, so `update()` can swap the
    // callback without re-registering it — and without replaying reports the
    // previous callback already received.
    this.cleanups.push(
      this.collector.addSink((report) => this.options.onReport?.(report)),
    );
    this.cleanups.push(this.collector.addSink(createConsoleReporter()));
    this.mountOverlay();

    // Replays whatever React logged before this controller existed, which is
    // the normal case: the mismatch is reported while the tree hydrates.
    this.cleanups.push(
      subscribeCapture((message) => {
        this.rememberMessage(message);
        this.mergeContext({ reactMessage: message });
        this.scheduleInspect();
      }),
    );

    this.scheduleSettlingInspections();
  }

  // React applies client values to mismatched subtrees via a client re-render a
  // few hundred ms after the initial hydration commit. We diff once per frame
  // and then across this short "settling window" to catch that, deduped. This
  // is a bounded, one-shot window — NOT a standing observer — so DOM changes
  // from later app state are never mistaken for hydration mismatches.
  private scheduleSettlingInspections(): void {
    this.scheduleInspect();
    const delays = [80, 250, 700, 1500];
    for (const delay of delays) {
      const last = delay === delays[delays.length - 1];
      const timer = setTimeout(() => {
        this.inspectAllRoots();
        if (last) this.warnUnmatchedRoots();
      }, delay);
      this.settlingTimers.push(timer);
    }
  }

  onRecoverableError = (
    error: unknown,
    info?: { componentStack?: string },
  ): void => {
    if (!isDev) return;
    const message = error instanceof Error ? error.message : String(error);
    this.rememberMessage(message);
    this.mergeContext({
      componentStack: info?.componentStack,
      component: firstComponentFromStack(info?.componentStack),
      reactMessage: message,
    });
    this.scheduleInspect();
  };

  private rememberMessage(message: string): void {
    if (this.messages.size >= MAX_CAPTURED && !this.messages.has(message)) {
      return;
    }
    this.messages.add(message);
  }

  private mergeContext(ctx: DetectionContext): void {
    this.pendingContext = {
      componentStack: ctx.componentStack ?? this.pendingContext.componentStack,
      component: ctx.component ?? this.pendingContext.component,
      location: ctx.location ?? this.pendingContext.location,
      reactMessage: ctx.reactMessage ?? this.pendingContext.reactMessage,
    };
  }

  private domContext(): DetectionContext {
    return {
      componentStack: this.pendingContext.componentStack,
      component: this.pendingContext.component,
      location: this.pendingContext.location,
    };
  }

  /**
   * Apply new options to a running inspector. `<HydrationInspector>` calls
   * this when its props change; before, it read them once at mount and every
   * later change was silently ignored until a reload.
   *
   * - `onReport` takes effect for the next report.
   * - `overlay` (on/off, `position`, `locale`) rebuilds the panel, replaying
   *   the reports so far — only when it actually changed, so inline objects
   *   re-created on every render do not remount it.
   * - `ignore`, `classify` and `maxReports` apply to everything reported from
   *   now on; reports already made stay as they are.
   */
  update(options: InspectorOptions): void {
    const overlayBefore = overlayKey(this.options.overlay);
    this.options = options;
    this.collector.configure({
      maxReports: options.maxReports,
      extra: options.classify,
      ignore: buildIgnore(options.ignore),
    });
    if (this.started && overlayKey(options.overlay) !== overlayBefore) {
      this.unmountOverlay();
      this.mountOverlay();
    }
  }

  private mountOverlay(): void {
    if (this.options.overlay === false) return;
    const handle = createOverlay(
      typeof this.options.overlay === 'object' ? this.options.overlay : {},
    );
    // Replay: a fresh overlay must show the reports collected before it.
    const detach = this.collector.addSink(handle.push, { replay: true });
    this.overlayTeardown = () => {
      detach();
      handle.destroy();
    };
  }

  private unmountOverlay(): void {
    this.overlayTeardown?.();
    this.overlayTeardown = null;
  }

  stop(): void {
    for (const timer of this.settlingTimers.splice(0)) clearTimeout(timer);
    this.clearScheduledInspect();
    this.unmountOverlay();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.started = false;
  }

  getReports(): readonly HydrationReport[] {
    return this.collector.getReports();
  }

  inspectNow(context: DetectionContext = {}): void {
    this.mergeContext(context);
    this.inspectAllRoots();
  }

  private inspectAllRoots(): void {
    if (
      !this.started ||
      typeof document === 'undefined' ||
      this.collector.isFull
    ) {
      return;
    }
    // 1) DOM diff — every visible mismatch (text/attribute/structure), precise
    //    path + component/source from the fiber.
    const configured = this.options.roots;
    const selectors = configured ?? snapshotSelectors();
    const context = this.domContext();
    const seen = new Set<Element>();
    for (const selector of selectors) {
      let root: Element | null = null;
      try {
        root = document.querySelector(selector);
      } catch {
        this.warnRoot(selector, `"${selector}" is not a valid CSS selector.`);
        continue;
      }
      if (!root) continue;
      this.matchedRoots.add(selector);
      if (seen.has(root)) continue;
      seen.add(root);
      if (configured && getServerHtmlForRoot(root) == null) {
        this.warnRoot(
          selector,
          `no server HTML was captured for "${selector}". Add it to the ` +
            '`selectors` prop of <HydrationSnapshotScript> so the server ' +
            'markup for that root is snapshotted.',
        );
        continue;
      }
      inspectRoot(root, this.collector, context, (divergence) =>
        resolveReactSource(divergence.element ?? null),
      );
    }

    // 2) React's own messages — the only source for class/style mismatches
    //    (React doesn't patch attributes into the DOM) and for pages with no
    //    snapshot. Value-based dedup means this never double-reports a
    //    mismatch the DOM diff already found.
    for (const message of this.messages) {
      reportFromMessage(message, this.collector, this.pendingContext, {
        locationless: 'skip',
      });
    }
    // 3) React's bare "hydration failed" message names no node. Next to a
    //    concrete report it is a card with no values; it earns its place only
    //    when nothing else was found — no snapshot script, say — because then
    //    it is the one sign that hydration failed at all. Deciding after the
    //    other messages keeps that independent of the order they arrived in.
    const concrete = this.collector
      .getReports()
      .some((r) => r.cause.messageId !== 'unknown.no-location');
    if (!concrete) {
      for (const message of this.messages) {
        reportFromMessage(message, this.collector, this.pendingContext, {
          locationless: 'only',
        });
      }
    }
  }

  // A configured root that matches nothing can never be inspected — usually a
  // typo, or a selector for markup this page does not have. Checked once the
  // settling window is over rather than on the first pass, so a root that is
  // rendered a moment after hydration is not reported by mistake.
  private warnUnmatchedRoots(): void {
    if (!this.started) return;
    for (const selector of this.options.roots ?? []) {
      if (this.matchedRoots.has(selector)) continue;
      this.warnRoot(
        selector,
        `no element matches "${selector}" on this page, so it was never ` +
          'inspected. Check the selector against your markup.',
      );
    }
  }

  private warnRoot(selector: string, detail: string): void {
    if (this.warnedRoots.has(selector)) return;
    this.warnedRoots.add(selector);
    // eslint-disable-next-line no-console
    console.warn(`[why-hydration] Skipping root: ${detail}`);
  }

  private scheduleInspect(): void {
    if (this.inspectScheduled) return;
    this.inspectScheduled = true;
    const run = () => {
      if (!this.inspectScheduled) return;
      this.clearScheduledInspect();
      this.inspectAllRoots();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    this.inspectTimer = setTimeout(run, INSPECT_FALLBACK_MS);
  }

  private clearScheduledInspect(): void {
    this.inspectScheduled = false;
    if (this.inspectTimer != null) {
      clearTimeout(this.inspectTimer);
      this.inspectTimer = null;
    }
  }
}

// What the overlay would render, so an update that only re-creates an equal
// options object — an inline `overlay={{ position }}` — does not remount it.
function overlayKey(overlay: InspectorOptions['overlay']): string {
  if (overlay === false) return 'off';
  const o = typeof overlay === 'object' ? overlay : {};
  return `${o.position ?? 'bottom-right'}|${o.locale ?? 'auto'}`;
}

function snapshotSelectors(): string[] {
  const snapshot = readSnapshot();
  const keys = snapshot ? Object.keys(snapshot.roots) : [];
  return keys.length > 0 ? keys : [...DEFAULT_SNAPSHOT_SELECTORS];
}

// A component stack lists frames innermost first, and the innermost ones are
// usually host elements — `at p`, `at span` — which are DOM tags, not
// components. Naming those as the culprit sends the reader to the wrong
// place, so skip them (lowercase by JSX convention) along with framework
// internals, and report the nearest component the developer actually wrote.
function firstComponentFromStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const frame = /(?:^|\n)\s*(?:at|in)\s+([A-Za-z0-9_$]+)/g;
  for (const match of stack.matchAll(frame)) {
    const name = match[1]!;
    if (/^[A-Z]/.test(name) && !isInternalComponent(name)) return name;
  }
  return undefined;
}
