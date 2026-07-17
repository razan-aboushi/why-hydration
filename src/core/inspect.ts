import { diffSnapshotAgainstDom } from './diff';
import { parseHydrationMessage } from './react-message';
import { getServerHtmlForRoot } from './snapshot';
import type { DetectionContext } from './types';
import type { ReportCollector } from './report';

export function inspectRoot(
  root: Element,
  collector: ReportCollector,
  context: DetectionContext = {},
): boolean {
  const serverHtml = getServerHtmlForRoot(root);
  if (serverHtml == null) return false;
  const divergence = diffSnapshotAgainstDom(serverHtml, root);
  if (!divergence) return false;
  if (context.reactMessage && !divergence.reactMessage) {
    divergence.reactMessage = context.reactMessage;
  }
  return collector.report(divergence, context) != null;
}

export function reportFromMessage(
  message: string,
  collector: ReportCollector,
  context: DetectionContext = {},
): boolean {
  const divergence = parseHydrationMessage(message);
  if (!divergence) return false;
  return (
    collector.report(divergence, {
      ...context,
      reactMessage: message,
    }) != null
  );
}
