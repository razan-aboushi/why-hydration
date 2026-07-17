/**
 * Client entry. We own `hydrateRoot`, so we pass the inspector's
 * `onRecoverableError` and wrap the app in its Provider.
 *
 * NOTE: To see real mismatches you must hydrate against server-rendered HTML.
 * Run this example with the tiny SSR server in `server.mjs` (`npm run dev`),
 * which renders the same <App/> to a string and serves it in #root.
 */

import { hydrateRoot } from 'react-dom/client';
import { createHydrationInspector } from 'why-hydration/react';
import App from './App';

const inspector = createHydrationInspector({
  // Pipe reports anywhere you like:
  onReport: (report) => console.info('[report]', report.cause.category),
});

const root = document.getElementById('root')!;

hydrateRoot(
  root,
  <inspector.Provider>
    <App />
  </inspector.Provider>,
  { onRecoverableError: inspector.onRecoverableError },
);
