# why-hydration

**Tells you which component broke hydration, what differed, and how to fix it — in dev, with zero production cost.**

<p align="center">
  <img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/overlay-hero.png" alt="why-hydration overlay showing three classified hydration mismatches" width="440">
</p>

React's hydration warnings tell you _that_ something mismatched, rarely _which
component_, _which value_, or _why_. `why-hydration` diffs the server DOM against
the client DOM, classifies the root cause, and hands you a specific fix.

```text
▸ React:          Warning: Text content did not match. Server: "١٢٣٤" Client: "1234"

▸ why-hydration:  ⬡ locale-format (92%) — PriceTag · body > main > span:nth-child(2)
                  Server: ١٢٣٤   Client: 1234
                  Why:  Same value, different digit scripts (Arabic-Indic vs Latin).
                        The server and client resolved to different locales.
                  Fix:  Pass an explicit locale + timezone to Intl on both sides,
                        or format the value after mount.
```

- 🔍 **Where** — component (best-effort) + exact DOM node + selector path.
- 🔀 **What** — server value vs client value, side by side.
- 🧠 **Why** — the cause, classified into a known category with a confidence score.
- 🛠️ **Fix** — a specific, actionable suggestion with a docs link.
- 🫧 **Zero prod cost** — everything is gated on `process.env.NODE_ENV` and
  tree-shakes to a **no-op** (~0 B, size-budgeted in CI).
- 🌐 **Arabic-first** — digit-script mismatches (٠١٢ vs 012) are a first-class cause.

Output goes to an in-browser **overlay**, structured **console** output, and an
**`onReport`** callback so you can pipe it to your own logging. React 18 & 19.

---

## Install

```bash
npm i -D why-hydration
```

`react` and `react-dom` are peer dependencies (`^18 || ^19`).

## 30-second setup

### Next.js — App Router

```tsx
// app/layout.tsx
import { HydrationSnapshotScript } from 'why-hydration/next/script';
import { HydrationInspector } from 'why-hydration/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {process.env.NODE_ENV !== 'production' && <HydrationSnapshotScript />}
      </head>
      <body>
        <HydrationInspector>{children}</HydrationInspector>
      </body>
    </html>
  );
}
```

### Next.js — Pages Router

```tsx
// pages/_document.tsx  → inside <Head>
import { HydrationSnapshotScript } from 'why-hydration/next/script';
// ...
<Head>{process.env.NODE_ENV !== 'production' && <HydrationSnapshotScript />}</Head>

// pages/_app.tsx
import { HydrationInspector } from 'why-hydration/next';
export default function App({ Component, pageProps }) {
  return (
    <HydrationInspector>
      <Component {...pageProps} />
    </HydrationInspector>
  );
}
```

### Vite / CRA / Remix (you own `hydrateRoot`)

```tsx
import { hydrateRoot } from 'react-dom/client';
import { createHydrationInspector } from 'why-hydration/react';

const inspector = createHydrationInspector();

hydrateRoot(document.getElementById('root')!, <App />, {
  onRecoverableError: inspector.onRecoverableError,
});
```

Add the snapshot script to your HTML `<head>` so the server DOM is captured
before hydration (Vite `index.html`, before your entry `<script>`). Copy-paste:

```html
<head>
  <!-- why-hydration snapshot — dev only, runs before hydration -->
  <script>
    (function () {
      var K = '__WHY_HYDRATION_SNAPSHOT__';
      if (typeof window === 'undefined' || window[K]) return;
      var S = ['#root'];
      function cap() {
        if (window[K]) return;
        var r = {};
        for (var i = 0; i < S.length; i++) {
          var el = document.querySelector(S[i]);
          if (el) r[S[i]] = el.innerHTML;
        }
        window[K] = { version: 1, capturedAt: Date.now(), roots: r };
      }
      if (document.readyState !== 'loading') cap();
      else {
        document.addEventListener('readystatechange', function () {
          if (document.readyState === 'interactive') cap();
        });
        document.addEventListener('DOMContentLoaded', cap);
      }
    })();
  </script>
</head>
```

> Prefer to generate it? `import { getSnapshotScriptSource } from 'why-hydration'`
> returns exactly this string. Without the snapshot script the tool still works
> from React's console warnings, but the precise DOM value/attribute diff needs
> it.

---

## What you'll see

When a mismatch happens in dev, you get three things (all off in production):

1. **An overlay** in the corner — one card per mismatch with the category,
   confidence, server vs client values, why it happened, and the fix. Dismissible.
2. **A grouped console block** — the same info, easy to copy into an issue.
3. **Your `onReport` callback** (if provided) — the structured `HydrationReport`.

A clean page with no mismatches shows **nothing** — no overlay, no logs.

---

## Options

```tsx
<HydrationInspector
  overlay             // boolean | { position: 'bottom-right' | ... }  (default: on in dev)
  onReport={(report) => sendToLogging(report)}
  ignore={['.grammarly-ext', (node) => node.hasAttribute('data-safe')]}
  classify={[myCustomRule]}   // extra classifiers, run before the built-ins
  maxReports={25}
>
  {children}
</HydrationInspector>
```

| Option       | Type                                                | Default        | Description                                               |
| ------------ | --------------------------------------------------- | -------------- | -------------------------------------------------------- |
| `overlay`    | `boolean \| OverlayOptions`                         | `true` in dev  | In-browser panel. `false` to disable.                    |
| `onReport`   | `(report: HydrationReport) => void`                 | –              | Called once per unique report.                           |
| `ignore`     | `Array<string \| (node: Element) => boolean>`       | `[]`           | Suppress known-safe mismatches by selector or predicate. |
| `classify`   | `Classifier[]`                                      | `[]`           | Custom rules, run **before** the built-ins.              |
| `maxReports` | `number`                                            | `25`           | Cap on unique reports.                                   |

---

## The `HydrationReport`

```ts
interface HydrationReport {
  id: string;
  timestamp: number;
  component?: string;
  componentStack?: string;
  location?: { file?: string; line?: number; column?: number };
  node: {
    path: string; // selector-style path to the node
    tagName?: string;
    attribute?: string;
    kind: 'text' | 'attribute' | 'structure' | 'node-added' | 'node-removed';
  };
  server: string | null;
  client: string | null;
  cause: {
    category: HydrationCauseCategory;
    confidence: number; // 0–1
    explanation: string;
    suggestion: string;
    docsUrl?: string;
  };
  raw?: { reactMessage?: string };
}
```

---

## Cause categories

The classifier runs an ordered list of rules; the first match above a confidence
threshold wins, otherwise `unknown`. Custom `classify` rules run first.

> **What is the "Learn more →" link?** Every report (overlay + console) carries a
> `docsUrl` that deep-links to the matching section **below** (e.g. the locale
> report links to [`#cause-locale-format`](#cause-locale-format)). Each section
> also cites the authoritative React/MDN reference for that cause.

<a id="cause-non-deterministic-value"></a>

### non-deterministic-value

<img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/cause-non-deterministic-value.png" alt="non-deterministic-value report" width="420">

Server and client rendered different random-looking values (UUID, token, React
`:r…:` id, or `Math.random()` output).
**Fix:** `useId()` for ids; generate randomness after mount; never call
`Math.random()`/`crypto` in render.
**Reference:** [React `useId()`](https://react.dev/reference/react/useId).

<a id="cause-date-time"></a>

### date-time

<img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/cause-date-time.png" alt="date-time report" width="420">

Values are dates/times that differ by a small delta — the clock or timezone moved
between server and client render.
**Fix:** render time after mount, or pass one server timestamp down and pin the
timezone when formatting.
**Reference:** [React — different client/server content](https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content).

<a id="cause-locale-format"></a>

### locale-format

<img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/cause-locale-format.png" alt="locale-format report" width="420">

Same underlying value, different formatting: **Arabic-Indic ٠١٢ vs Latin 012**,
decimal/thousand separators (`1,234.56` vs `1.234,56`), or date order (MM/DD vs
DD/MM).
**Fix:** pass an explicit `locale` + timezone to `Intl` on both sides, or format
after mount.
**Reference:** [MDN `Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat).

<a id="cause-browser-only-api"></a>

### browser-only-api

<img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/cause-browser-only-api.png" alt="browser-only-api report" width="420">

The client rendered content the server left empty — a read of `window`,
`document`, `localStorage`, `navigator`, or `matchMedia` during render.
**Fix:** gate behind a mounted flag / `useEffect`, or use `useSyncExternalStore`
with a server snapshot.
**Reference:** [React `useSyncExternalStore` (server rendering)](https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering).

<a id="cause-viewport-branching"></a>

### viewport-branching

A whole subtree was added/removed/swapped — usually a JS width check that
branches the tree at first render.
**Fix:** switch with CSS media queries at first paint, not JavaScript.
**Reference:** [MDN — CSS media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries).

<a id="cause-invalid-html-nesting"></a>

### invalid-html-nesting

<img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/cause-invalid-html-nesting.png" alt="invalid-html-nesting report" width="420">

A node was moved/ejected because the markup is invalid (`<div>` in `<p>`, nested
`<a>`). The browser repairs the server DOM so it no longer matches React.
**Fix:** correct the markup validity.
**Reference:** [MDN — `<p>` (permitted content)](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/p).

<a id="cause-whitespace-minification"></a>

### whitespace-minification

The mismatch is whitespace-only — an HTML minifier collapsed whitespace around
the root differently from React.
**Fix:** check your minifier settings (e.g. `conservativeCollapse`) around the
app root.
**Reference:** [React — text content hydration](https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content).

<a id="cause-third-party-dom-mutation"></a>

### third-party-dom-mutation

<img src="https://raw.githubusercontent.com/razan-aboushi/why-hydration/main/docs/screenshots/cause-third-party-dom-mutation.png" alt="third-party-dom-mutation report" width="420">

An attribute was injected by a browser extension (Grammarly, ColorZilla, …) or an
early third-party script before hydration.
**Fix:** usually harmless — add `suppressHydrationWarning` to the leaf, or defer
third-party init to post-hydration.
**Reference:** [React `suppressHydrationWarning`](https://react.dev/reference/react-dom/components/common#suppressing-unavoidable-hydration-mismatch-errors).

<a id="cause-unknown"></a>

### unknown

A mismatch was detected but didn't match a known signature. The report still
shows the exact server vs client values and node path so you can diagnose it.
**Fix:** compare the two values — the cause is usually one of the categories
above. If you find a reliable signal, add a custom rule via the `classify`
option (see [CONTRIBUTING.md](CONTRIBUTING.md)).
**Reference:** [React — hydration mismatch errors](https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content).

---

## How it works

1. **Snapshot** — a tiny inline script captures each hydration root's server
   `innerHTML` before hydration (at `document.readyState === 'interactive'`,
   which runs before deferred scripts).
2. **Detect** — `onRecoverableError` where you own `hydrateRoot`; otherwise a
   dev-only `console.error` interceptor catches React's hydration warnings (the
   Next.js fallback).
3. **Diff** — once, right after hydration (and again on each detection signal),
   walk the server snapshot and the live DOM in parallel and find the first
   divergence + its selector path. Framework/extension noise (scripts, the
   overlay itself) is skipped. There is **no standing observer**, so legitimate
   post-hydration updates are never mistaken for mismatches.
4. **Classify** — ordered heuristics assign a category + confidence + fix. If the
   DOM diff can't locate it (e.g. invalid nesting the browser silently
   repaired), the tool falls back to React's message.
5. **Report** — overlay (plain DOM in a shadow root, never the app's React) +
   grouped console block + `onReport` callback. Deduped, capped at `maxReports`.

Everything above is gated on `process.env.NODE_ENV !== 'production'` and
tree-shakes to a no-op in production. CI enforces it with a size budget
(`npm run size`).

## Is it safe? (production & privacy)

- **Zero production cost.** Every code path is gated on
  `process.env.NODE_ENV !== 'production'`, written inline so bundlers fold it and
  tree-shake the whole implementation. In a production build
  `<HydrationInspector>` is a pass-through and `createHydrationInspector` returns
  no-ops. CI's size budget fails if a real production bundle is larger than a
  few bytes (measured with webpack + terser, what Next.js/CRA/Vite actually use).
- **Read-only.** The tool never modifies your app's DOM — it only appends its own
  overlay container (isolated in a shadow root) and reads the server snapshot.
- **No app-React dependency for the overlay.** The overlay is plain DOM, so it
  works even while your React tree is mid-recovery.
- **SSR-safe.** Detection is client-only; nothing runs (or patches `console`) on
  the server.
- **No network, no telemetry, no dependencies.** Nothing leaves the browser.
  `react`/`react-dom` are optional peers; there are **zero** runtime
  dependencies. Reports go only to your overlay, your console, and your own
  `onReport` callback.
- **Values are rendered as text** (never `innerHTML`), and docs links are
  restricted to `http(s)` — no injection from mismatched content.

## FAQ / Troubleshooting

**Does it work outside Next.js?** Yes — anywhere React hydrates: Vite, CRA,
Remix, or your own SSR. Use `createHydrationInspector` where you own
`hydrateRoot`, or `<HydrationInspector>` + the snapshot script anywhere else. The
core engine (`why-hydration`) is framework-agnostic.

**Nothing shows up.** Confirm `NODE_ENV` isn't `production`, that
`<HydrationInspector>` wraps your app, and (for precise value diffs) that the
snapshot script is in `<head>` and runs before hydration. Without the snapshot
the tool still reports from React's console warnings.

**The "Learn more →" link 404s.** The links point to this README on GitHub
(`github.com/razan-aboushi/why-hydration#cause-…`). Publish the repo under that
name, or change `DOCS_BASE` in `src/core/classify/rules.ts` and the `repository`
field in `package.json` to match your URL.

**Can I send reports to my logging?** Yes — pass `onReport`; you receive the full
`HydrationReport`.

**Does it slow my app down?** No. It's dev-only, runs the diff once after
hydration (plus once per real React signal), and holds no standing observers.

## Contributing

Adding a cause category is a self-contained change — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © [Razan Aboushi](https://github.com/razan-aboushi)
