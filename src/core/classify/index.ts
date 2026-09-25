import type { Cause, Classifier, Divergence } from '../types';
import {
  BUILT_IN_RULES,
  UNKNOWN_CAUSE,
  UNKNOWN_NO_LOCATION_CAUSE,
} from './rules';

export const CONFIDENCE_THRESHOLD = 0.5;

export interface ClassifyOptions {
  extra?: readonly Classifier[];
  threshold?: number;
}

/**
 * True when a divergence carries nothing to point at: no server value, no
 * client value, no tag and no attribute. That is what React's bare "hydration
 * failed" message parses to when it names no node.
 */
export function isLocationless(d: Divergence): boolean {
  return d.server == null && d.client == null && !d.tagName && !d.attribute;
}

export function classify(
  divergence: Divergence,
  options: ClassifyOptions = {},
): Cause {
  const threshold = options.threshold ?? CONFIDENCE_THRESHOLD;
  const rules: readonly Classifier[] = [
    ...(options.extra ?? []),
    ...BUILT_IN_RULES,
  ];

  for (const rule of rules) {
    let result: Cause | null = null;
    try {
      result = rule(divergence);
    } catch {
      result = null;
    }
    if (result && result.confidence >= threshold) {
      return result;
    }
  }
  return isLocationless(divergence) ? UNKNOWN_NO_LOCATION_CAUSE : UNKNOWN_CAUSE;
}

export {
  BUILT_IN_RULES,
  UNKNOWN_CAUSE,
  UNKNOWN_NO_LOCATION_CAUSE,
} from './rules';
