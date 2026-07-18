# Changelog

## 0.1.2

Accuracy overhaul from running on a large production Next.js app — fixes real
false positives and misclassifications.

- **New `attribute-mismatch` category.** A `class`/`style` difference (e.g. a
  conditional `forceHide` class) is now reported correctly with the exact
  changed tokens — previously misclassified as "locale-format" because the class
  list contained digits.
- **Component name + source file:line.** Reports now name the offending
  component (e.g. `<PriceTag>`) and, where React exposes it, the source
  `file:line`, read from React's fiber and its hydration diff.
- **Modern React message parsing.** React 18.3+/19 print a JSX diff tree
  (`+`/`-` lines) instead of "Prop X did not match"; the parser now understands
  it and extracts the attribute/value and component. This is required because
  React does **not** patch mismatched attributes, so the DOM diff alone can't
  see them.
- **Third-party noise is skipped.** Hidden ads/consent/analytics iframes (e.g.
  Google Funding Choices `googlefcInactive`, `about:blank`) no longer produce
  false "browser-only API" reports and no longer mask your real mismatch.
- **Stricter locale detection** — number-format matching now requires actual
  numeric values, so class lists / ids with digits no longer false-match.
- **Reliable timing.** Detection re-checks across a short settling window
  because React applies client values to mismatched subtrees a few hundred ms
  after hydration; value-based dedup prevents double reports.
- Docs: detection scope (full load vs client navigation), `attribute-mismatch`
  category, refreshed screenshots showing component names.

## 0.1.1

Fixes found by end-to-end testing in a real Next.js app (App Router + Pages
Router, React 18 & 19). **0.1.0 is broken in Next.js — use 0.1.1 or later.**

- **`'use client'` directive** is now injected into the `react` and `next`
  bundles. Without it, `<HydrationInspector>` crashed in a Server Component
  layout (`useRef only works in Client Components`). `why-hydration/next` is now
  client-only; import `HydrationSnapshotScript` from `why-hydration/next/script`.
- **Diff skips framework comment markers** (React `<!--$-->`, RSC payload) that
  were reported as false `viewport-branching` mismatches.
- **Inline `style` is normalized through the CSSOM**, so the server snapshot and
  the browser-normalized live DOM (`#hex` → `rgb()`, spacing) no longer produce
  a false `unknown` mismatch.
- **`typesVersions`** added so subpath types resolve under `moduleResolution:
  "node"` (fixes `next build` type errors in apps using classic resolution).

Verified live: locale-format, non-deterministic-value, date-time, and
browser-only-api classify correctly in App Router and Pages Router; the tool is
a zero-code no-op in a production `next build`.

## 0.1.0

Initial release.
