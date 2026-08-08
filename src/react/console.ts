import { formatConsoleArgs, isHydrationMessage } from '../core/react-message';
import type { HydrationReport } from '../core/types';
import type { ReportSink } from '../core/report';

type ErrorFn = (...args: unknown[]) => void;

export function installConsoleInterceptor(
  onMessage: (message: string, args: readonly unknown[]) => void,
): () => void {
  if (typeof console === 'undefined') return () => {};
  const original = console.error;
  const patched: ErrorFn = (...args: unknown[]) => {
    try {
      const message = formatConsoleArgs(args);
      if (message && isHydrationMessage(message)) {
        onMessage(message, args);
      }
    } catch {
      /* never let interception break normal logging */
    }
    // `apply` rather than a bound copy, so uninstalling can hand back the exact
    // function we replaced. Restoring a bound copy instead leaves a wrapper
    // behind on every install/uninstall cycle.
    original.apply(console, args);
  };
  console.error = patched as typeof console.error;

  return () => {
    if (console.error === (patched as typeof console.error)) {
      console.error = original as typeof console.error;
    }
  };
}

const BADGE = 'color:#f59e0b;font-weight:bold';
const DIM = 'color:#9ca3af';

export function createConsoleReporter(): ReportSink {
  const sink: ReportSink = (report: HydrationReport) => {
    const title = `%c⬡ why-hydration%c ${report.cause.category} — ${report.node.path}`;
    console.group(title, BADGE, DIM);
    console.log('%cServer:%c', 'color:#fb7185', '', report.server ?? '(none)');
    console.log('%cClient:%c', 'color:#4ade80', '', report.client ?? '(none)');
    if (report.component) {
      console.log('%cComponent:%c', DIM, '', `<${report.component}>`);
    }
    if (report.location?.file) {
      const loc = report.location.line
        ? `${report.location.file}:${report.location.line}`
        : report.location.file;
      console.log('%cSource:%c', DIM, '', loc);
    }
    console.log('%cWhy:%c', DIM, '', report.cause.explanation);
    console.log('%cFix:%c', 'color:#86efac', '', report.cause.suggestion);
    if (report.cause.docsUrl) {
      console.log('%cDocs:%c', DIM, '', report.cause.docsUrl);
    }
    if (report.componentStack) {
      console.log('%cComponent stack:%c', DIM, '', report.componentStack);
    }
    console.groupEnd();
  };
  return sink;
}
