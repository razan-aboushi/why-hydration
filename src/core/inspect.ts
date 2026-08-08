import { collectSnapshotAgainstDom } from './diff';
import {
  extractComponentFromMessage,
  parseAllHydrationDivergences,
} from './react-message';
import { getServerHtmlForRoot } from './snapshot';
import type { DetectionContext, Divergence } from './types';
import type { ReportCollector } from './report';

// Diff the server snapshot against a live root and report EVERY divergence
// (deduped by value in the collector). Returns how many new reports were made.
//
// A divergence found here is classified purely on its own shape. React's
// console message describes ONE node, so copying it onto every node the diff
// finds would let an unrelated warning (say a `validateDOMNesting` complaint
// elsewhere on the page) drive their classification.
export function inspectRoot(
  root: Element,
  collector: ReportCollector,
  context: DetectionContext = {},
  enrich?: (divergence: Divergence) => DetectionContext,
): number {
  const serverHtml = getServerHtmlForRoot(root);
  if (serverHtml == null) return 0;
  const divergences = collectSnapshotAgainstDom(serverHtml, root);
  let reported = 0;
  for (const divergence of divergences) {
    const enriched = enrich ? enrich(divergence) : {};
    if (collector.report(divergence, { ...context, ...enriched }) != null) {
      reported += 1;
    }
  }
  return reported;
}

/**
 * A message we could not resolve to anything concrete. React emits several
 * follow-ups per mismatch ("An error occurred during hydration…", "the entire
 * root will switch to client rendering") that describe the *consequence*, not
 * the divergence, and they parse to a divergence with no values, no tag and no
 * attribute. Reporting those renders an empty "Unknown — (none)/(none)" card
 * next to the real diagnosis. React has already logged them itself; we have
 * nothing to add.
 */
function hasEvidence(divergence: Divergence): boolean {
  return (
    divergence.server != null ||
    divergence.client != null ||
    divergence.tagName != null ||
    divergence.attribute != null
  );
}

// Report every divergence a React hydration message describes. Deduped by value
// in the collector, so it's safe to call alongside the DOM diff and repeatedly.
export function reportFromMessage(
  message: string,
  collector: ReportCollector,
  context: DetectionContext = {},
): number {
  const divergences = parseAllHydrationDivergences(message);
  const component = extractComponentFromMessage(message) ?? context.component;
  let reported = 0;
  for (const divergence of divergences) {
    if (!hasEvidence(divergence)) continue;
    if (
      collector.report(divergence, { ...context, component, reactMessage: message }) !=
      null
    ) {
      reported += 1;
    }
  }
  return reported;
}
