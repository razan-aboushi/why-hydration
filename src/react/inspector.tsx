/**
 * `<HydrationInspector>` implementation (dev-only).
 *
 * The component is a thin lifecycle wrapper around {@link InspectorController}.
 * It creates the controller and starts detection during the *first render*
 * (via a `useRef` initializer) so the console interceptor is installed before
 * the children hydrate — that's what lets it catch React's own warnings. The
 * effect only handles teardown on unmount.
 */

import * as React from 'react';
import type { Classifier, HydrationReport } from '../core/types';
import { InspectorController } from './controller';
import type { OverlayOptions } from './overlay';

export interface HydrationInspectorProps {
  children: React.ReactNode;
  /** Overlay on (default in dev), off (`false`), or configured. */
  overlay?: boolean | OverlayOptions;
  /** Called for every unique report. */
  onReport?: (report: HydrationReport) => void;
  /** Suppress known-safe mismatches by selector or predicate. */
  ignore?: Array<string | ((node: Element) => boolean)>;
  /** Extra classifiers, run before the built-ins. */
  classify?: Classifier[];
  /** Cap on unique reports. Default 25. */
  maxReports?: number;
}

export function InspectorImpl(props: HydrationInspectorProps): React.ReactElement {
  const { children, overlay, onReport, ignore, classify, maxReports } = props;

  const controllerRef = React.useRef<InspectorController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new InspectorController({
      overlay,
      onReport,
      ignore,
      classify,
      maxReports,
    });
    // Start during first render so detection is live before children hydrate.
    controllerRef.current.start();
  }

  React.useEffect(() => {
    const controller = controllerRef.current;
    // Re-run the DOM diff after the initial commit as a safety net, and tear
    // everything down on unmount.
    return () => controller?.stop();
  }, []);

  return React.createElement(React.Fragment, null, children);
}
