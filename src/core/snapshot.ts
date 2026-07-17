/**
 * Snapshot layer.
 *
 * Before React hydrates, we capture the server-rendered `innerHTML` of each
 * hydration root and stash it on `window.__WHY_HYDRATION_SNAPSHOT__`. That
 * frozen server DOM is what makes a real server-vs-client diff possible after
 * the client has already mutated the live tree.
 *
 * The capture is delivered as a tiny inline script (see
 * {@link getSnapshotScriptSource}) that must run *before* the framework's
 * hydration script. Timing detail: we register a `readystatechange` listener
 * and capture when `document.readyState` first becomes `'interactive'`. Per the
 * HTML spec that transition happens after parsing completes but *before*
 * deferred scripts (i.e. before hydration) execute — so the snapshot reflects
 * the untouched server markup.
 */

/** Roots snapshotted by default, in priority order. Covers CRA/Vite/Next. */
export const DEFAULT_SNAPSHOT_SELECTORS = ['#root', '#__next', 'body'];

/** Global key the snapshot is stored under. */
export const SNAPSHOT_KEY = '__WHY_HYDRATION_SNAPSHOT__';

export interface Snapshot {
  version: 1;
  capturedAt: number;
  /** Map of root selector → server-rendered innerHTML at capture time. */
  roots: Record<string, string>;
}

declare global {
  interface Window {
    [SNAPSHOT_KEY]?: Snapshot;
  }
}

/**
 * Build the inline JavaScript source that captures the snapshot. The result is
 * dependency-free ES5 so it runs in any browser without transpilation, and is
 * safe to inline into a `<script>`.
 *
 * @param selectors Root selectors to snapshot. Defaults to
 *   {@link DEFAULT_SNAPSHOT_SELECTORS}.
 */
export function getSnapshotScriptSource(
  selectors: readonly string[] = DEFAULT_SNAPSHOT_SELECTORS,
): string {
  // Serialize selectors safely for embedding in a script string. We also guard
  // against `</script>` breaking out of the tag.
  const serialized = JSON.stringify(selectors).replace(/</g, '\\u003c');
  return `(function(){var K=${JSON.stringify(SNAPSHOT_KEY)};if(typeof window==="undefined"||window[K])return;var S=${serialized};function cap(){if(window[K])return;var r={};for(var i=0;i<S.length;i++){var el=document.querySelector(S[i]);if(el)r[S[i]]=el.innerHTML;}window[K]={version:1,capturedAt:Date.now(),roots:r};}if(document.readyState!=="loading"){cap();}else{document.addEventListener("readystatechange",function(){if(document.readyState==="interactive")cap();});document.addEventListener("DOMContentLoaded",cap);}})();`;
}

/** Read the snapshot captured by the inline script, if present. */
export function readSnapshot(): Snapshot | undefined {
  if (typeof window === 'undefined') return undefined;
  return window[SNAPSHOT_KEY];
}

/**
 * Return the server-rendered innerHTML for a given live root element, matched
 * by the selectors it satisfies. Returns `undefined` when no snapshot covers it
 * (in which case the diff engine degrades gracefully).
 */
export function getServerHtmlForRoot(root: Element): string | undefined {
  const snapshot = readSnapshot();
  if (!snapshot) return undefined;
  for (const selector of Object.keys(snapshot.roots)) {
    try {
      if (root.matches(selector) || root === document.querySelector(selector)) {
        return snapshot.roots[selector];
      }
    } catch {
      // Ignore invalid selectors from user configuration.
    }
  }
  return undefined;
}

/**
 * Runtime fallback capture, used only when the inline script was not installed.
 * NOTE: by the time this runs the client may already have mutated the DOM, so
 * it is strictly best-effort and less reliable than the inline script.
 */
export function captureSnapshotNow(
  selectors: readonly string[] = DEFAULT_SNAPSHOT_SELECTORS,
): Snapshot | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  if (window[SNAPSHOT_KEY]) return window[SNAPSHOT_KEY];
  const roots: Record<string, string> = {};
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) roots[selector] = el.innerHTML;
  }
  const snapshot: Snapshot = { version: 1, capturedAt: Date.now(), roots };
  window[SNAPSHOT_KEY] = snapshot;
  return snapshot;
}
