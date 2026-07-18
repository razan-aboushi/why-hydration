// Injects the `'use client'` directive at the top of the client entry bundles.
// esbuild (via tsup) strips source-level module directives when bundling, so we
// re-add it here. Only the React/Next provider entries are client; the core
// engine and the Next snapshot <script> stay server-usable and are untouched.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const targets = [
  'react.js',
  'react.cjs',
  'next/index.js',
  'next/index.cjs',
];

const DIRECTIVE = `'use client';\n`;

for (const rel of targets) {
  const file = join(dist, rel);
  try {
    const src = await readFile(file, 'utf8');
    if (src.startsWith(`'use client'`) || src.startsWith(`"use client"`)) {
      continue;
    }
    await writeFile(file, DIRECTIVE + src);
  } catch (err) {
    console.error(`postbuild-use-client: could not patch ${rel}:`, err.message);
    process.exitCode = 1;
  }
}
