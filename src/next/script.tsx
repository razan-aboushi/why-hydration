/**
 * `why-hydration/next/script` — the inline pre-hydration snapshot script.
 *
 * Render this in your document `<head>` (App Router: `app/layout.tsx` head;
 * Pages Router: `pages/_document.tsx`). It emits a tiny inline `<script>` that
 * captures the server DOM before Next's hydration runs. It renders `null` in
 * production and tree-shakes away.
 */

import * as React from 'react';
import { getSnapshotScriptSource } from '../core/snapshot';

export interface HydrationSnapshotScriptProps {
  /** Root selectors to snapshot. Defaults to `['#root', '#__next', 'body']`. */
  selectors?: string[];
  /** CSP nonce, forwarded to the inline `<script>`. */
  nonce?: string;
}

/**
 * Inline snapshot `<script>`. Must render before the framework's hydration
 * script — putting it in `<head>` guarantees that.
 */
export function HydrationSnapshotScript(
  props: HydrationSnapshotScriptProps = {},
): React.ReactElement | null {
  // Inline gate so a prod build folds to `return null` and drops the snapshot
  // source (and its import) entirely.
  if (process.env.NODE_ENV === 'production') return null;
  const source = getSnapshotScriptSource(props.selectors);
  return React.createElement('script', {
    nonce: props.nonce,
    suppressHydrationWarning: true,
    // Inline, dependency-free ES5 — safe to set as HTML.
    dangerouslySetInnerHTML: { __html: source },
  });
}
