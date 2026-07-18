import type { DetectionContext } from '../core/types';

// Best-effort: walk the React fiber attached to a DOM node to recover the
// owning component name and (in React 18 dev builds) its source file/line.
// This is what turns a bare selector path into "which component / file".
// Purely read-only, dev-only, and defensive — any failure returns {}.

interface Fiber {
  type?: unknown;
  return?: Fiber | null;
  _debugSource?: { fileName?: string; lineNumber?: number; columnNumber?: number };
  _debugOwner?: Fiber | null;
}

function getFiber(node: Node): Fiber | null {
  for (const key in node) {
    if (
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$')
    ) {
      return (node as unknown as Record<string, Fiber>)[key] ?? null;
    }
  }
  return null;
}

function componentName(type: unknown): string | undefined {
  if (!type || typeof type === 'string') return undefined;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || undefined;
  }
  if (typeof type === 'object') {
    const obj = type as {
      displayName?: string;
      render?: { displayName?: string; name?: string };
      type?: unknown;
    };
    if (obj.displayName) return obj.displayName;
    if (obj.render) return obj.render.displayName || obj.render.name;
    if (obj.type) return componentName(obj.type);
  }
  return undefined;
}

/**
 * Resolve the component and source location responsible for a live DOM node.
 * Returns a {@link DetectionContext} fragment (`component`, `location`) that the
 * reporter merges into the report.
 */
export function resolveReactSource(node: Element | null): DetectionContext {
  if (!node) return {};
  try {
    let fiber: Fiber | null = getFiber(node);
    let component: string | undefined;
    let location: DetectionContext['location'];
    let hops = 0;
    while (fiber && hops < 80) {
      if (!component) {
        const name = componentName(fiber.type);
        // Skip built-in host components (div, span…) — we want the nearest
        // user component that owns this node.
        if (name && !/^[a-z]/.test(name)) component = name;
      }
      if (!location && fiber._debugSource?.fileName) {
        location = {
          file: fiber._debugSource.fileName,
          line: fiber._debugSource.lineNumber,
          column: fiber._debugSource.columnNumber,
        };
      }
      if (component && location) break;
      fiber = fiber.return ?? null;
      hops += 1;
    }
    const result: DetectionContext = {};
    if (component) result.component = component;
    if (location) result.location = location;
    return result;
  } catch {
    return {};
  }
}
