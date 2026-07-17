import * as React from 'react';
import { getSnapshotScriptSource } from '../core/snapshot';

export interface HydrationSnapshotScriptProps {
  selectors?: string[];
  nonce?: string;
}

export function HydrationSnapshotScript(
  props: HydrationSnapshotScriptProps = {},
): React.ReactElement | null {
  if (process.env.NODE_ENV === 'production') return null;
  const source = getSnapshotScriptSource(props.selectors);
  return React.createElement('script', {
    nonce: props.nonce,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: { __html: source },
  });
}
