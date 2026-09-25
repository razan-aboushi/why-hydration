/**
 * Size budget that proves the zero-production-cost rule.
 *
 * Each check bundles a public entry with **webpack in production mode**
 * (terser + `sideEffects:false` tree-shaking) — the same toolchain Next.js and
 * CRA use for production. Webpack defines `process.env.NODE_ENV = 'production'`,
 * which folds the inline `process.env.NODE_ENV` gates and lets the entire
 * dev-only implementation (overlay, diff engine, classifier, controller) be
 * tree-shaken away. If any of it survives, these budgets fail — that is the
 * regression guard for the zero-prod-cost rule.
 *
 * The limits sit just above today's output (99 B / 99 B / 27 B) on purpose. A
 * generous budget hides small leaks: a single module-level `new
 * Intl.PluralRules()` once survived tree-shaking and ran on every production
 * page, growing the bundle to 148 B — well inside the old 600 B limit.
 */

module.exports = [
  {
    name: 'react entry (prod tree-shakes to a no-op)',
    path: 'dist/react.js',
    import: '{ HydrationInspector, createHydrationInspector }',
    limit: '130 B',
    gzip: true,
  },
  {
    name: 'next adapters (prod no-op)',
    path: 'dist/next/index.js',
    import: '{ HydrationInspector, createHydrationInspector }',
    limit: '130 B',
    gzip: true,
  },
  {
    name: 'next/script (prod no-op)',
    path: 'dist/next/script.js',
    import: '{ HydrationSnapshotScript }',
    limit: '60 B',
    gzip: true,
  },
];
