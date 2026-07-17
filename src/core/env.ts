/**
 * The single source of truth for the "dev only" gate.
 *
 * Consumers bundle their apps with a bundler that statically replaces
 * `process.env.NODE_ENV`. In a production build this becomes
 * `'production' !== 'production'` → `false`, and every branch guarded by
 * {@link isDev} is dead code that tree-shakes away (we ship
 * `sideEffects: false`). That is what enforces the zero-production-cost rule.
 *
 * We intentionally read `process.env.NODE_ENV` inline rather than caching it in
 * a module-level const, so bundlers can inline and fold each usage site.
 */
export const isDev: boolean =
  typeof process !== 'undefined' &&
  process.env != null &&
  process.env.NODE_ENV !== 'production';
