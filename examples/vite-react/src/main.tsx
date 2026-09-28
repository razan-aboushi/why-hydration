/**
 * Client entry. We own `hydrateRoot`, so we pass the inspector's
 * `onRecoverableError` and wrap the app in its Provider.
 *
 * `server.mjs` renders the same <App/> to HTML first (`npm run dev`); this
 * hydrates it, and each scenario makes the two renders differ on purpose.
 */

import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createHydrationInspector } from 'why-hydration/react';
import App, { scenarioFrom } from './App';

const inspector = createHydrationInspector({
  // Pipe reports anywhere you like:
  onReport: (report) => console.info('[report]', report.cause.category),
});

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <inspector.Provider>
      <App scenario={scenarioFrom(location.href)} />
    </inspector.Provider>
  </StrictMode>,
  { onRecoverableError: inspector.onRecoverableError },
);
