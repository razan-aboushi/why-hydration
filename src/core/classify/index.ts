import type { Cause, Classifier, Divergence } from '../types';
import { BUILT_IN_RULES, UNKNOWN_CAUSE } from './rules';

export const CONFIDENCE_THRESHOLD = 0.5;

export interface ClassifyOptions {
  extra?: readonly Classifier[];
  threshold?: number;
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
  return UNKNOWN_CAUSE;
}

export { BUILT_IN_RULES, UNKNOWN_CAUSE } from './rules';
