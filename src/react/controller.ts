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
  private readonly options: InspectorOptions;
  private readonly cleanups: Array<() => void> = [];
  private started = false;
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

  start(): void {
    if (this.started || !isDev || typeof window === 'undefined') return;
    this.started = true;
    this.pendingContext = {};
    this.messageReported = false;

    if (this.options.onReport) {
      this.collector.addSink(this.options.onReport);
    }
    this.collector.addSink(createConsoleReporter());
    if (this.options.overlay !== false) {
      const overlayOpts: OverlayOptions =
        typeof this.options.overlay === 'object' ? this.options.overlay : {};
      const handle = createOverlay(overlayOpts);
      this.collector.addSink(handle.push);
      this.cleanups.push(() => handle.destroy());
    }

    const restore = installConsoleInterceptor((message) => {
      this.mergeContext({ reactMessage: message });
      this.scheduleInspect();
    });
    this.cleanups.push(restore);

    this.scheduleInspect();
  }

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

  private mergeContext(ctx: DetectionContext): void {
    this.pendingContext = {
      componentStack: this.pendingContext.componentStack ?? ctx.componentStack,
      component: this.pendingContext.component ?? ctx.component,
      location: this.pendingContext.location ?? ctx.location,
      reactMessage: this.pendingContext.reactMessage ?? ctx.reactMessage,
    };
  }

  stop(): void {
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
    const selectors = this.options.roots ?? snapshotSelectors();
    const seen = new Set<Element>();
    for (const selector of selectors) {
      const root = document.querySelector(selector);
      if (!root || seen.has(root)) continue;
      seen.add(root);
      inspectRoot(root, this.collector, this.pendingContext);
    }

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
    const run = () => this.inspectAllRoots();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    } else {
      Promise.resolve().then(run);
    }
  }
}

function snapshotSelectors(): string[] {
  const snapshot = readSnapshot();
  const keys = snapshot ? Object.keys(snapshot.roots) : [];
  return keys.length > 0 ? keys : [...DEFAULT_SNAPSHOT_SELECTORS];
}

function firstComponentFromStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const match = /\n?\s*(?:at|in)\s+([A-Za-z0-9_$]+)/.exec(stack);
  return match?.[1];
}
