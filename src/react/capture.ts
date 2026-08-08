import { installConsoleInterceptor } from './console';

/**
 * Module-scoped capture of React's hydration warnings.
 *
 * React logs a mismatch while it hydrates the tree *below* the inspector, which
 * is long before any effect runs — so interception has to begin during render.
 * Render is also the one place a component may be invoked more than once per
 * mount (Strict Mode renders twice, with fresh hook state each time), so the
 * state lives here rather than on an instance: a second call is then a genuine
 * no-op instead of a second interceptor that nobody owns and nobody removes.
 */

export type CaptureListener = (message: string) => void;

// Hydration warnings are emitted once per page load; this only guards against
// an app that logs matching messages in a loop.
const MAX_CAPTURED = 50;

const captured = new Set<string>();
const listeners = new Set<CaptureListener>();
let uninstall: (() => void) | null = null;
let owners = 0;

/** Start intercepting. Idempotent, and safe to call from render. */
export function startCapture(): void {
  if (uninstall || typeof window === 'undefined') return;
  uninstall = installConsoleInterceptor((message) => {
    if (captured.has(message)) return;
    if (captured.size < MAX_CAPTURED) captured.add(message);
    for (const listener of [...listeners]) listener(message);
  });
}

/**
 * Subscribe to hydration messages. Whatever was captured before subscribing is
 * replayed immediately, so a listener attached after hydration — or re-attached
 * across a Strict Mode stop/start cycle — still sees what React logged.
 */
export function subscribeCapture(listener: CaptureListener): () => void {
  startCapture();
  listeners.add(listener);
  owners += 1;
  for (const message of [...captured]) listener(message);

  return () => {
    if (!listeners.delete(listener)) return;
    owners -= 1;
    // The backlog outlives the last subscriber on purpose: hydration happens
    // once per page, so a remounted inspector still needs those messages.
    // Only the console patch is handed back.
    if (owners === 0 && uninstall) {
      uninstall();
      uninstall = null;
    }
  };
}

/** Drop the interceptor and the recorded backlog (tests, hot reload). */
export function resetCapture(): void {
  uninstall?.();
  uninstall = null;
  listeners.clear();
  captured.clear();
  owners = 0;
}
