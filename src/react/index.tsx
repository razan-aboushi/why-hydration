/**
 * `why-hydration/react` — public React entry.
 *
 * Everything below the `__DEV__` gate tree-shakes away in production builds:
 * bundlers replace `process.env.NODE_ENV` with `'production'`, fold `__DEV__`
 * to `false`, and drop the dev-only implementation (and its transitive imports:
 * overlay, diff engine, classifier). In production `<HydrationInspector>` is a
 * pass-through fragment and `createHydrationInspector` returns no-ops.
 */

import * as React from 'react';
import { InspectorController, type InspectorOptions } from './controller';
import { InspectorImpl, type HydrationInspectorProps } from './inspector';

function PassThrough(props: { children?: React.ReactNode }): React.ReactElement {
  return React.createElement(React.Fragment, null, props.children);
}

/**
 * Wrap your app to diagnose hydration mismatches in dev. Zero cost in prod.
 *
 * ```tsx
 * <HydrationInspector>{children}</HydrationInspector>
 * ```
 *
 * The `process.env.NODE_ENV` comparison is written inline (not hoisted to a
 * variable) so a production bundler replaces it, folds the ternary to
 * `PassThrough`, and tree-shakes `InspectorImpl` and its entire dev-only
 * dependency graph away.
 */
export const HydrationInspector: (
  props: HydrationInspectorProps,
) => React.ReactElement =
  process.env.NODE_ENV !== 'production' ? InspectorImpl : PassThrough;

export interface HydrationInspectorHandle {
  /** Pass to `hydrateRoot(..., { onRecoverableError })`. */
  onRecoverableError: (
    error: unknown,
    info?: { componentStack?: string },
  ) => void;
  /** Optional provider to wrap your app (shares this inspector's controller). */
  Provider: (props: { children?: React.ReactNode }) => React.ReactElement;
}

/**
 * For Vite / CRA / Remix where you own `hydrateRoot`. Creates a single
 * controller, wires `onRecoverableError`, and returns a matching `Provider`.
 *
 * ```tsx
 * const inspector = createHydrationInspector();
 * hydrateRoot(el, <App />, { onRecoverableError: inspector.onRecoverableError });
 * ```
 */
export function createHydrationInspector(
  options: InspectorOptions = {},
): HydrationInspectorHandle {
  // Inline gate: in prod this returns first and the dev code below (and its
  // imports) is unreachable, so it tree-shakes away.
  if (process.env.NODE_ENV === 'production') {
    return {
      onRecoverableError: () => {},
      Provider: PassThrough,
    };
  }

  const controller = new InspectorController(options);
  // Start immediately so the interceptor + sinks are live before hydration.
  controller.start();

  function Provider(props: { children?: React.ReactNode }): React.ReactElement {
    React.useEffect(() => () => controller.stop(), []);
    return React.createElement(React.Fragment, null, props.children);
  }

  return {
    onRecoverableError: controller.onRecoverableError,
    Provider,
  };
}

export type { HydrationInspectorProps } from './inspector';
export type { InspectorOptions } from './controller';
export type { OverlayOptions } from './overlay';
export type {
  Cause,
  Classifier,
  DetectionContext,
  Divergence,
  HydrationCauseCategory,
  HydrationReport,
} from '../core/types';
