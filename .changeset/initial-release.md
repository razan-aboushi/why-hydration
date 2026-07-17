---
'why-hydration': minor
---

Initial release. Dev-only React hydration-mismatch diagnostic: server-vs-client
DOM diff, an ordered cause classifier (non-deterministic, date/time, locale
formatting — Arabic-first, browser-only APIs, viewport branching, invalid HTML
nesting, whitespace/minification, third-party DOM mutation), a shadow-DOM
overlay, grouped console output, and an `onReport` callback. Adapters for React
(`hydrateRoot`) and Next.js (App + Pages Router). Zero production cost —
everything tree-shakes to a no-op, enforced by a size budget in CI.
