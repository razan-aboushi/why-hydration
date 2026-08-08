/**
 * Whether the dev-only detection machinery is allowed to run.
 *
 * Production is opt-OUT here, not opt-in, and that distinction matters. The
 * public entries already gate the entire dev implementation behind an inline
 * `process.env.NODE_ENV === 'production'` check that bundlers fold to a
 * constant and tree-shake, so a production build never reaches this module at
 * all — `npm run size` measures the result at 99 B.
 *
 * What is left is the browser case where a bundler substitutes
 * `process.env.NODE_ENV` but never defines `process` itself. Vite, Rollup and
 * esbuild all do exactly that, which compiled a `typeof process !== 'undefined'`
 * guard down to `false` and silently disabled the inspector for every one of
 * them — no overlay, no console output, no error. Treating a missing `process`
 * as "not production" is the only reading that keeps those setups working.
 */
function readNodeEnv(): string | undefined {
  try {
    // Deliberately a plain member expression: bundlers that substitute
    // `process.env.NODE_ENV` only match this exact shape, so writing it any
    // other way (optional chaining, a destructure) would defeat the folding.
    return process.env.NODE_ENV;
  } catch {
    // `process` is not defined in this bundle. Absence is not evidence of
    // production.
    return undefined;
  }
}

export const isDev: boolean = readNodeEnv() !== 'production';
