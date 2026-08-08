export const DEFAULT_SNAPSHOT_SELECTORS = ['#root', '#__next', 'body'];

export const SNAPSHOT_KEY = '__WHY_HYDRATION_SNAPSHOT__';

export interface Snapshot {
  version: 1;
  capturedAt: number;
  roots: Record<string, string>;
}

declare global {
  interface Window {
    [SNAPSHOT_KEY]?: Snapshot;
  }
}

export function getSnapshotScriptSource(
  selectors: readonly string[] = DEFAULT_SNAPSHOT_SELECTORS,
): string {
  const serialized = JSON.stringify(selectors).replace(/</g, '\\u003c');
  return `(function(){var K=${JSON.stringify(SNAPSHOT_KEY)};if(typeof window==="undefined"||window[K])return;var S=${serialized};function cap(){if(window[K])return;var r={};for(var i=0;i<S.length;i++){var el=document.querySelector(S[i]);if(el)r[S[i]]=el.innerHTML;}window[K]={version:1,capturedAt:Date.now(),roots:r};}if(document.readyState!=="loading"){cap();}else{document.addEventListener("readystatechange",function(){if(document.readyState==="interactive")cap();});document.addEventListener("DOMContentLoaded",cap);}})();`;
}

export function readSnapshot(): Snapshot | undefined {
  if (typeof window === 'undefined') return undefined;
  return window[SNAPSHOT_KEY];
}

export function getServerHtmlForRoot(root: Element): string | undefined {
  const snapshot = readSnapshot();
  if (!snapshot) return undefined;
  for (const selector of Object.keys(snapshot.roots)) {
    try {
      if (root.matches(selector) || root === document.querySelector(selector)) {
        return snapshot.roots[selector];
      }
    } catch {
      /* invalid selector */
    }
  }
  return findNestedServerHtml(snapshot, root);
}

/**
 * A root the caller asked for (`roots: ['#app']`) may sit *inside* a captured
 * root (`body`) instead of being one itself, because the snapshot selectors are
 * chosen on the server and the inspected roots on the client. Recover its
 * server HTML by locating the same element by id inside the captured markup, so
 * a custom `roots` option still works against the default snapshot selectors.
 */
function findNestedServerHtml(
  snapshot: Snapshot,
  root: Element,
): string | undefined {
  if (!root.id) return undefined;
  const idSelector = `#${escapeId(root.id)}`;
  for (const selector of Object.keys(snapshot.roots)) {
    let container: Element | null = null;
    try {
      container = document.querySelector(selector);
    } catch {
      continue; // invalid selector
    }
    if (!container || container === root || !container.contains(root)) continue;
    const html = snapshot.roots[selector];
    if (html == null) continue;
    const parsed = parseInert(html, container.tagName);
    let match: Element | null = null;
    try {
      match = parsed.querySelector(idSelector);
    } catch {
      match = null;
    }
    if (match) return match.innerHTML;
  }
  return undefined;
}

function escapeId(id: string): string {
  const cssEscape = (globalThis as { CSS?: { escape?(value: string): string } })
    .CSS?.escape;
  return typeof cssEscape === 'function'
    ? cssEscape(id)
    : id.replace(/[^\w-]/g, '\\$&');
}

// Kept local rather than shared with the diff engine: this module is also
// reached from the server-rendered `next/script` entry, which must not pull the
// dev-only diff implementation into its bundle.
function parseInert(html: string, tagName: string): Element {
  const doc = document.implementation.createHTMLDocument('');
  const container = doc.createElement(tagName || 'div');
  container.innerHTML = html;
  return container;
}

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
