# Changelog

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
