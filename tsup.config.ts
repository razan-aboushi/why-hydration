import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.tsx',
    'next/index': 'src/next/index.ts',
    'next/script': 'src/next/script.tsx',
  },
  format: ['esm', 'cjs'],
  dts: true,
  // Split shared/dev-only modules into chunks so a consumer's production build
  // (which folds the `process.env.NODE_ENV` gate) stops importing them and
  // tree-shakes the entire dev implementation away. Without splitting, the
  // pre-bundled entry keeps orphaned top-level declarations.
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // `react`/`react-dom` are peer deps — never bundle them.
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // Let bundlers replace and dead-code-eliminate the dev-only branches
  // in consumer production builds. We do NOT hard-define NODE_ENV here,
  // so the shipped code keeps the `process.env.NODE_ENV` guard intact.
  esbuildOptions(options) {
    options.legalComments = 'none';
  },
});
