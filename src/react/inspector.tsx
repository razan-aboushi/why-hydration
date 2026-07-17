import * as React from 'react';
import type { Classifier, HydrationReport } from '../core/types';
import { InspectorController } from './controller';
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

  const controllerRef = React.useRef<InspectorController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new InspectorController({
      overlay,
      onReport,
      ignore,
      classify,
      maxReports,
    });
    controllerRef.current.start();
  }

  React.useEffect(() => {
    const controller = controllerRef.current;
    return () => controller?.stop();
  }, []);

  return React.createElement(React.Fragment, null, children);
}
