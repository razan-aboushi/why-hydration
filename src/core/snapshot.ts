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
  return undefined;
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
