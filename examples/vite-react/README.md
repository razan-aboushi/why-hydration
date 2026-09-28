# Example: Vite + React with SSR (you own `hydrateRoot`)

Demonstrates the `createHydrationInspector()` integration path, on a real
server render: `server.mjs` runs Vite in SSR mode, renders `<App/>` to HTML, and
the client hydrates it. A hydration mismatch is a difference between those two
renders — a client-only Vite app has no server HTML to differ from.

Wiring to look at:

- `index.html` — the inline **snapshot script** in `<head>` (runs before
  hydration).
- `server.mjs` + `src/entry-server.tsx` — the server render.
- `src/main.tsx` — `createHydrationInspector()` + `onRecoverableError` +
  `<inspector.Provider>`, under `<StrictMode>`.
- `src/App.tsx` — the trigger-mismatch scenarios.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and pick a scenario. Each is its own URL, so it is
rendered on the server and hydrated fresh:

| URL                | What differs                                                | Reported as             |
| ------------------ | ----------------------------------------------------------- | ----------------------- |
| `?scenario=random` | `Math.random()` in render                                   | non-deterministic value |
| `?scenario=clock`  | the time, a second apart                                    | date / time             |
| `?scenario=price`  | `ar-EG` on the server, `en-US` in the browser               | locale formatting       |
| `?scenario=nav`    | a `window.innerWidth` check (use a window wider than 768px) | viewport branching      |
| `?scenario=theme`  | a `localStorage` read                                       | browser-only API        |

The overlay appears in the corner with one card per mismatch, and the console
prints a grouped report for each.
