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
    diff.ts            server-vs-client tree diff → every Divergence (LCS-aligned)
    classify/
      detectors.ts     pure predicates (isRandomLike, hasArabicIndicDigits, …)
      messages.ts      the English text of every cause, by message id  ← and here
      rules.ts         the ordered built-in classifier rules  ← add here
      index.ts         the classify() engine
    report.ts          ReportCollector: classify + dedupe + dispatch
    react-message.ts   parse React's console hydration warnings
  react/               <HydrationInspector>, overlay, console, controller
    i18n.ts            overlay languages: English strings, lang detection
    locales/           ar.ts, he.ts, fa.ts — each language's text and plurals  ← and here
  next/                Next.js adapters + snapshot <Script>
test/                  vitest specs (acceptance table lives in acceptance.test.ts)
```

## Adding a cause category

1. **Add the category** to `HydrationCauseCategory` in `src/core/types.ts`.
2. **Add pure detectors** (if needed) to `src/core/classify/detectors.ts`, each
   with its own unit test in `test/classify.test.ts` or `test/*.test.ts`.
3. **Write the words once, in every language.** Add a message id to
   `MessageId` and its English text to `EN_MESSAGES` in
   `src/core/classify/messages.ts`, then the same message to each catalog in
   `src/react/locales/` (`ar.ts`, `he.ts`, `fa.ts`), and the category's label
   to every `categories` map. The catalogs are typed against `MessageId`, so a
   missing translation is a compile error, not a silent English fallback. In a
   template, put code in backticks and page data in `{placeholders}` — the
   overlay isolates both so they keep their own direction inside a
   right-to-left sentence. Persian uses the zero-width non-joiner (U+200C) in
   words like «می‌کند» and the Persian letters ی and ک; the tests check both.
4. **Write the rule** in `src/core/classify/rules.ts`. A rule is
   `(divergence: Divergence) => Cause | null` — return `null` to abstain. On a
   match return `{ category, confidence, ...describe('<message-id>', params),
docsUrl }`; `describe()` fills in `explanation`, `suggestion`, `messageId`
   and `params`.
5. **Place it in `BUILT_IN_RULES`** at the right priority. Rules run in order;
   the first match above the confidence threshold wins. More specific rules go
   earlier, or guard broader rules so they don't shadow yours (see how
   `viewportBranching` yields to `invalidNesting`).
6. **Add a docs anchor** `<a id="cause-<category>"></a>` and a section to the
   README's "Cause categories", and point `docsUrl` at it.
7. **Add an acceptance case** to `test/acceptance.test.ts` that builds a real
   server/client DOM pair (or a React message) and asserts your category, and
   add your variant to `VARIANTS` in `test/overlay-rtl.test.ts` so its Arabic
   rendering is checked too.

The English strings are pinned by `test/classify-golden.test.ts`. If you change
the wording of an existing message on purpose, update
`test/fixtures/classify-golden.json` in the same commit — `explanation` and
`suggestion` are what people log and match on, so a change there is
user-visible.

Rules must be **pure and total** — no DOM mutation, no throwing (the engine
catches throws, but don't rely on it). Keep `confidence` honest: reserve `>0.85`
for signatures that are unambiguous.

## Commit style

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Keep changes
small and scoped. Add a Changeset (`npx changeset`) for anything user-facing.

## Non-negotiables

- **Zero production cost.** Never reference dev-only code from a path that isn't
  behind an inline `process.env.NODE_ENV` gate. `npm run size` must stay green.
  Keep module top levels free of calls a bundler cannot prove pure (`new
Intl.PluralRules()`, `new Map(...)` with work in it): those survive
  tree-shaking and run on every production page. Create them lazily.
- **Read-only.** The tool never mutates the host app's DOM except its own overlay
  container, and never depends on the app's React instance for the overlay.
