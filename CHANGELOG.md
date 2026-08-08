# Changelog

## 0.1.5

### Patch Changes

- 7b16e20: Fix the inspector lifecycle, bound detection cost, and close detection gaps.

  **Lifecycle**

  - `createHydrationInspector()` is no longer dead after a React Strict Mode
    remount. Its `<Provider>` only ever stopped the controller, so Strict Mode's
    setup → cleanup → setup left the documented Vite/CRA/Remix integration
    silently doing nothing for the rest of the session.
  - The dev check no longer requires a `process` global. Vite, Rollup and esbuild
    substitute `process.env.NODE_ENV` without defining `process` itself, which
    compiled the old `typeof process !== 'undefined'` guard down to `false` and
    disabled the inspector entirely in those bundlers.
  - Scheduling races an animation frame against a timer, so a page that is hidden
    at load — where the browser suspends `requestAnimationFrame` outright — is
    still inspected.
  - The console capture hands `console.error` back correctly when the same
    listener subscribes twice, and its message cap now drops past-cap messages
    instead of recording-but-forwarding them (which broke dedup exactly when the
    cap was meant to engage).

  **Cost**

  - A burst of React warnings arriving in one frame triggers one diff pass rather
    than one per warning.
  - Captured server markup is parsed once per root and reused across the settling
    window instead of being re-parsed on every pass.
  - Retained warning text is bounded, so an app erroring in a render loop cannot
    grow the per-pass cost without limit.

  **Detection**

  - `date-time` no longer fires on ordinary values. `Date.parse` accepts almost
    anything — `100` is the year 100, `server-0` is the year 2000 — so prices,
    counts and ids were being diagnosed as a clock or timezone drift. A value must
    now look like a date by shape.
  - Arabic formatting mismatches are detected when both sides use the same digit
    script: grouping/decimal separators, field order and times in Arabic-Indic and
    Persian digits previously fell through to `unknown`.
  - Values differing only by invisible bidirectional control marks (LRM/RLM/ALM,
    isolates) are detected and named. Different ICU versions emit different marks
    for the same `Intl` call, so Node and the browser routinely produce strings
    that look identical and are not.
  - Report values are no longer truncated mid surrogate pair.

  **Overlay**

  - A panel re-mounted after being dismissed no longer reports a stale count or
    promise scrolling it cannot do.

  Note for anyone consuming `report.cause.category` in an `onReport` sink: the
  `date-time` and `locale-format` fixes change which category some mismatches
  resolve to.

## 0.1.4

- **License: restored MIT.** Re-added `LICENSE` (MIT) and set
  `"license": "MIT"` in `package.json`; the file is included in the published
  npm tarball.
- **RTL support for the overlay.** Fixed a real bug: the CSS `all` shorthand
  used to reset the overlay's Shadow DOM styles deliberately excludes
  `direction`/`unicode-bidi` (per the CSS spec), so a host page with
  `<html dir="rtl">` leaked `direction: rtl` into the overlay, flipping its
  flex/grid layout and text alignment (verified against a real browser). The
  overlay now explicitly forces `direction: ltr` on its shadow host and panel,
  so it always renders left-to-right — matching its English content —
  regardless of the host page's directionality. No configuration needed.
- **README rewritten** for technical accuracy and completeness: corrected the
  cause-category priority order (`third-party-dom-mutation` runs before
  `browser-only-api`/`viewport-branching`, not after), corrected the stale
  "diffs once, first divergence" description of the detection pipeline to
  match the current collect-all/settling-window/LCS-alignment behavior,
  documented the full `createHydrationInspector`/`OverlayOptions`/
  `HydrationSnapshotScript` API surface (including the previously-undocumented
  `roots` option), added a "What is a hydration mismatch" primer, an RTL
  section, and a table of contents.

## 0.1.3

Stability + accuracy overhaul from running on a large production Next.js app.
Detection is now **deterministic** and reports **every** mismatch at once.

- **LCS child alignment.** Children are matched by an LCS (tag+id) instead of by
  index, so a node the client injects mid-tree (react-toastify's
  `<section class="Toastify">`, a portal, a modal, an ad) is treated as an
  insertion — it no longer shifts every sibling and cascade into a different set
  of false positives on each refresh. This makes results **consistent across
  refreshes**.
- **Collect all mismatches.** The diff now returns every divergence on the page
  (deduped by value), so the overlay shows them together instead of one-per-
  refresh. The panel is scrollable and shows a "↓ N issues — scroll to see all"
  hint (with a ✕ close button) when there are more than fit.
- **Skip client-injected containers** — toasts, modals, portals, overlays,
  tooltips, consent banners, chat/analytics widgets (by class/role/`aria-live`)
  are never reported and never mask a real mismatch.
- **Skip pending Suspense fallbacks** — content inside a streaming `<!--$?-->`
  boundary (server `Loading…` vs client content) is expected, not a mismatch.
- **No duplicates** — value-based dedup means the same mismatch (e.g. two links
  with the same conditional class) appears once.
- **All class/style mismatches captured.** React can emit several changes in one
  hydration message; the parser now extracts all of them (not just the first).
- Adjacent delete+insert is coalesced into a single `structure` report.
- License: removed MIT (now `UNLICENSED`); added the author's LinkedIn.

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
