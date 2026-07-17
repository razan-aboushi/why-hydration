/**
 * The classifier engine. Runs user-supplied rules first, then the built-ins,
 * and returns the first {@link Cause} whose confidence clears the threshold.
 */

import type { Cause, Classifier, Divergence } from '../types';
import { BUILT_IN_RULES, UNKNOWN_CAUSE } from './rules';

/** Minimum confidence for a rule's verdict to be accepted. */
export const CONFIDENCE_THRESHOLD = 0.5;

export interface ClassifyOptions {
  /** Extra classifiers, run *before* the built-ins (higher precedence). */
  extra?: readonly Classifier[];
  /** Override the confidence threshold (defaults to {@link CONFIDENCE_THRESHOLD}). */
  threshold?: number;
}

/**
 * Classify a single divergence into a cause. Never throws: a rule that throws
 * is skipped so one bad custom classifier can't break diagnostics.
 */
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
      // A misbehaving classifier must not break the pipeline.
      result = null;
    }
    if (result && result.confidence >= threshold) {
      return result;
    }
  }
  return UNKNOWN_CAUSE;
}

export { BUILT_IN_RULES, UNKNOWN_CAUSE } from './rules';
