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

  const options: InspectorOptions = {
    overlay,
    onReport,
    ignore,
    classify,
    maxReports,
  };
  // Seeded from the first render and kept current by the effect below — not
  // written during render, which React may discard or repeat.
  const optionsRef = React.useRef(options);
  const controllerRef = React.useRef<InspectorController | null>(null);

  React.useEffect(() => {
    // Everything stateful is owned by the effect so React controls its
    // lifetime. Strict Mode's setup → cleanup → setup then yields one live
    // controller, fully torn down and fully rebuilt, and the messages React
    // already logged are replayed to it from the capture backlog.
    const controller = new InspectorController(optionsRef.current);
    controllerRef.current = controller;
    controller.start();
    return () => {
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  // Props that change after mount reach the running controller instead of
  // being ignored until a reload. The controller compares what matters, so
  // inline values re-created on every render cost nothing.
  React.useEffect(() => {
    optionsRef.current = options;
    controllerRef.current?.update(options);
    // `options` is rebuilt every render; its parts are the real dependencies.
  }, [overlay, onReport, ignore, classify, maxReports]);

  return React.createElement(React.Fragment, null, children);
}
