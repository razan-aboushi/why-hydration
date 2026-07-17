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
 */

module.exports = [
  {
    name: 'react entry (prod tree-shakes to a no-op)',
    path: 'dist/react.js',
    import: '{ HydrationInspector, createHydrationInspector }',
    limit: '600 B',
    gzip: true,
  },
  {
    name: 'next adapters (prod no-op)',
    path: 'dist/next/index.js',
    import: '{ HydrationInspector, HydrationSnapshotScript }',
    limit: '600 B',
    gzip: true,
  },
  {
    name: 'next/script (prod no-op)',
    path: 'dist/next/script.js',
    import: '{ HydrationSnapshotScript }',
    limit: '400 B',
    gzip: true,
  },
];
