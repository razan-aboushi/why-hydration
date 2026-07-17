/**
 * Two console concerns, both dev-only:
 *
 * 1. {@link installConsoleInterceptor} — temporarily wraps `console.error` to
 *    catch React's hydration warnings (the fallback detection signal for
 *    Next.js, where we don't own `hydrateRoot`). It forwards a reconstructed
 *    message and always calls the original `console.error` so nothing is
 *    swallowed.
 * 2. {@link createConsoleReporter} — a report sink that prints one grouped,
 *    readable block per mismatch.
 */

import { formatConsoleArgs, isHydrationMessage } from '../core/react-message';
import type { HydrationReport } from '../core/types';
import type { ReportSink } from '../core/report';

type ErrorFn = (...args: unknown[]) => void;

/**
 * Wrap `console.error` and invoke `onMessage` for hydration-related messages.
 * Returns a restore function. Idempotent per call.
 */
export function installConsoleInterceptor(
  onMessage: (message: string, args: readonly unknown[]) => void,
): () => void {
  if (typeof console === 'undefined') return () => {};
  const original = console.error.bind(console) as ErrorFn;
  const patched: ErrorFn = (...args: unknown[]) => {
    try {
      const message = formatConsoleArgs(args);
      if (message && isHydrationMessage(message)) {
        onMessage(message, args);
      }
    } catch {
      // Never let interception break normal logging.
    }
    original(...args);
  };
  console.error = patched as typeof console.error;

  return () => {
    // Only restore if nobody else re-patched on top of us.
    if (console.error === (patched as typeof console.error)) {
      console.error = original as typeof console.error;
    }
  };
}

const BADGE = 'color:#f59e0b;font-weight:bold';
const DIM = 'color:#9ca3af';

/** A sink that prints a grouped, readable console block per report. */
export function createConsoleReporter(): ReportSink {
  const sink: ReportSink = (report: HydrationReport) => {
    const title = `%c⬡ why-hydration%c ${report.cause.category} — ${report.node.path}`;
    // eslint-disable-next-line no-console
    console.group(title, BADGE, DIM);
    // eslint-disable-next-line no-console
    console.log('%cServer:%c', 'color:#fb7185', '', report.server ?? '(none)');
    // eslint-disable-next-line no-console
    console.log('%cClient:%c', 'color:#4ade80', '', report.client ?? '(none)');
    if (report.component) {
      // eslint-disable-next-line no-console
      console.log('%cComponent:%c', DIM, '', report.component);
    }
    // eslint-disable-next-line no-console
    console.log('%cWhy:%c', DIM, '', report.cause.explanation);
    // eslint-disable-next-line no-console
    console.log('%cFix:%c', 'color:#86efac', '', report.cause.suggestion);
    if (report.cause.docsUrl) {
      // eslint-disable-next-line no-console
      console.log('%cDocs:%c', DIM, '', report.cause.docsUrl);
    }
    if (report.componentStack) {
      // eslint-disable-next-line no-console
      console.log('%cComponent stack:%c', DIM, '', report.componentStack);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  };
  return sink;
}
