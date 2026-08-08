import * as React from 'react';
import type { Classifier, HydrationReport } from '../core/types';
import { startCapture } from './capture';
import { InspectorController, type InspectorOptions } from './controller';
import type { OverlayOptions } from './overlay';

export interface HydrationInspectorProps {
  children: React.ReactNode;
  overlay?: boolean | OverlayOptions;
  onReport?: (report: HydrationReport) => void;
  ignore?: Array<string | ((node: Element) => boolean)>;
  classify?: Classifier[];
  maxReports?: number;
}

export function InspectorImpl(
  props: HydrationInspectorProps,
): React.ReactElement {
  const { children, overlay, onReport, ignore, classify, maxReports } = props;

  // The one thing that cannot wait for an effect: React logs the mismatch while
  // it hydrates the children below, and effects run after that. Capture is
  // module-scoped and idempotent, so Strict Mode — which renders twice with
  // fresh hook state — starts it once instead of leaving a stray interceptor.
  startCapture();

  const optionsRef = React.useRef<InspectorOptions>({});
  optionsRef.current = { overlay, onReport, ignore, classify, maxReports };

  React.useEffect(() => {
    // Everything stateful is owned by the effect so React controls its
    // lifetime. Strict Mode's setup → cleanup → setup then yields one live
    // controller, fully torn down and fully rebuilt, and the messages React
    // already logged are replayed to it from the capture backlog.
    const controller = new InspectorController(optionsRef.current);
    controller.start();
    return () => controller.stop();
  }, []);

  return React.createElement(React.Fragment, null, children);
}
