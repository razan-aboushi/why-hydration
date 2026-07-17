# Contributing to why-hydration

Thanks for helping! The most valuable contribution is usually a **new or
sharper cause classifier**, so that's documented first.

## Setup

```bash
npm install
npm run test      # vitest (jsdom)
npm run typecheck # tsc --noEmit
npm run lint
npm run build     # tsup → ESM + CJS + .d.ts
npm run size      # asserts the prod entries tree-shake to a no-op
```

`npm run ci` runs the full gate (lint → typecheck → test → build → size), the
same as GitHub Actions.

## Project layout

```
src/
  core/                framework-agnostic engine (the `why-hydration` entry)
    snapshot.ts        pre-hydration server-DOM capture
    diff.ts            server-vs-client tree diff → first Divergence
    classify/
      detectors.ts     pure predicates (isRandomLike, hasArabicIndicDigits, …)
      rules.ts         the ordered built-in classifier rules  ← add here
      index.ts         the classify() engine
    report.ts          ReportCollector: classify + dedupe + dispatch
    react-message.ts   parse React's console hydration warnings
  react/               <HydrationInspector>, overlay, console, controller
  next/                Next.js adapters + snapshot <Script>
test/                  vitest specs (acceptance table lives in acceptance.test.ts)
```

## Adding a cause category

1. **Add the category** to `HydrationCauseCategory` in `src/core/types.ts`.
2. **Add pure detectors** (if needed) to `src/core/classify/detectors.ts`, each
   with its own unit test in `test/classify.test.ts` or `test/*.test.ts`.
3. **Write the rule** in `src/core/classify/rules.ts`. A rule is
   `(divergence: Divergence) => Cause | null` — return `null` to abstain. Return
   `{ category, confidence, explanation, suggestion, docsUrl }` on a match.
4. **Place it in `BUILT_IN_RULES`** at the right priority. Rules run in order;
   the first match above the confidence threshold wins. More specific rules go
   earlier, or guard broader rules so they don't shadow yours (see how
   `viewportBranching` yields to `invalidNesting`).
5. **Add a docs anchor** `<a id="cause-<category>"></a>` and a section to the
   README's "Cause categories", and point `docsUrl` at it.
6. **Add an acceptance case** to `test/acceptance.test.ts` that builds a real
   server/client DOM pair (or a React message) and asserts your category.

Rules must be **pure and total** — no DOM mutation, no throwing (the engine
catches throws, but don't rely on it). Keep `confidence` honest: reserve `>0.85`
for signatures that are unambiguous.

## Commit style

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Keep changes
small and scoped. Add a Changeset (`npx changeset`) for anything user-facing.

## Non-negotiables

- **Zero production cost.** Never reference dev-only code from a path that isn't
  behind an inline `process.env.NODE_ENV` gate. `npm run size` must stay green.
- **Read-only.** The tool never mutates the host app's DOM except its own overlay
  container, and never depends on the app's React instance for the overlay.
