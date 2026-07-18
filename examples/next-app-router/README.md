# Example: Next.js App Router

A minimal Next.js 15 App Router app wired with `why-hydration`, plus a page that
deterministically triggers a **locale-format** hydration mismatch (the server
renders Arabic-Indic digits, the client renders Latin).

Wiring to look at:

- `app/layout.tsx` — `<HydrationSnapshotScript />` in `<head>` (dev only) and
  `<HydrationInspector>` wrapping the app in `<body>`.
- `app/triggers.tsx` — the client component that produces the mismatch.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The diagnostic overlay appears bottom-right and
classifies the mismatch as `locale-format`, with the server vs client values and
the fix. The same report is printed to the console. Verified on React 18 and 19.
