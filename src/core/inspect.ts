/**
 * Ties the snapshot + diff engine to a live DOM root and a collector.
 *
 * `inspectRoot` reads the frozen server HTML for a root, diffs it against the
 * (now hydrated) live DOM, and reports the first divergence. When no snapshot
 * is available it degrades to message-only reporting via {@link reportFromMessage}.
 */

import { diffSnapshotAgainstDom } from './diff';
import { parseHydrationMessage } from './react-message';
import { getServerHtmlForRoot } from './snapshot';
import type { DetectionContext } from './types';
import type { ReportCollector } from './report';

/**
 * Diff a live root against its server snapshot and report the first divergence.
 * Returns `true` if a report was produced.
 */
export function inspectRoot(
  root: Element,
  collector: ReportCollector,
  context: DetectionContext = {},
): boolean {
  const serverHtml = getServerHtmlForRoot(root);
  if (serverHtml == null) return false;
  const divergence = diffSnapshotAgainstDom(serverHtml, root);
  if (!divergence) return false;
  // Carry any React message from context onto the divergence so message-only
  // categories (invalid nesting) can still contribute.
  if (context.reactMessage && !divergence.reactMessage) {
    divergence.reactMessage = context.reactMessage;
  }
  return collector.report(divergence, context) != null;
}

/**
 * Report directly from a React hydration console message when a DOM diff isn't
 * possible (no snapshot) or didn't locate the divergence.
 */
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
