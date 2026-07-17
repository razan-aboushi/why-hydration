# Example: Vite + React (you own `hydrateRoot`)

Demonstrates the `createHydrationInspector()` integration path. Each component in
`src/App.tsx` deterministically triggers one cause category.

Wiring to look at:

- `index.html` — the inline **snapshot script** in `<head>` (runs before
  hydration).
- `src/main.tsx` — `createHydrationInspector()` + `onRecoverableError` +
  `<inspector.Provider>`.
- `src/App.tsx` — the trigger-mismatch scenarios.

## Run

This example needs server-rendered HTML to hydrate against (that's what a
hydration mismatch _is_). Add a small SSR dev server, or wire it into your own
SSR template, then:

```bash
npm install
npm run dev
```

Open the app, pick a scenario, and reload — the overlay appears in the corner
and the console prints a grouped report per mismatch.

> A pure client-only Vite SPA won't produce hydration mismatches because there
> is no server HTML to diverge from. Use SSR (Vite's SSR mode, Express +
> `renderToString`, or Remix) to see it in action.
