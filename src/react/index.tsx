// NOTE: the `'use client'` directive for this entry is injected into the built
// output by scripts/postbuild-use-client.mjs (esbuild strips source-level module
// directives when bundling). This entry only exports client components.
import * as React from 'react';
import { InspectorController, type InspectorOptions } from './controller';
import { InspectorImpl, type HydrationInspectorProps } from './inspector';

function PassThrough(props: {
  children?: React.ReactNode;
}): React.ReactElement {
  return React.createElement(React.Fragment, null, props.children);
}

// The process.env.NODE_ENV checks are inline (not hoisted to a variable) so
// production bundlers fold them and tree-shake the dev-only implementation.
export const HydrationInspector: (
  props: HydrationInspectorProps,
) => React.ReactElement =
  process.env.NODE_ENV !== 'production' ? InspectorImpl : PassThrough;

export interface HydrationInspectorHandle {
  onRecoverableError: (
    error: unknown,
    info?: { componentStack?: string },
  ) => void;
  Provider: (props: { children?: React.ReactNode }) => React.ReactElement;
}

export function createHydrationInspector(
  options: InspectorOptions = {},
): HydrationInspectorHandle {
  if (process.env.NODE_ENV === 'production') {
    return {
      onRecoverableError: () => {},
      Provider: PassThrough,
    };
  }

  const controller = new InspectorController(options);
  controller.start();

  function Provider(props: {
    children?: React.ReactNode;
  }): React.ReactElement {
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
