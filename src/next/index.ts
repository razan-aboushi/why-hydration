/**
 * `why-hydration/next` — Next.js adapters (App Router + Pages Router).
 *
 * For Next you don't own `hydrateRoot`, so detection uses the console-
 * interception + DOM-diff fallback built into `<HydrationInspector>`. Wiring:
 *
 * App Router (`app/layout.tsx`):
 * ```tsx
 * import { HydrationSnapshotScript } from 'why-hydration/next/script';
 * import { HydrationInspector } from 'why-hydration/next';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <head>{process.env.NODE_ENV !== 'production' && <HydrationSnapshotScript />}</head>
 *       <body><HydrationInspector>{children}</HydrationInspector></body>
 *     </html>
 *   );
 * }
 * ```
 *
 * Pages Router: put `<HydrationSnapshotScript />` in `pages/_document.tsx`'s
 * `<Head>` and wrap `<Component {...pageProps} />` with `<HydrationInspector>`
 * in `pages/_app.tsx`.
 */

export {
  HydrationInspector,
  createHydrationInspector,
} from '../react/index';
export type {
  HydrationInspectorProps,
  HydrationInspectorHandle,
  InspectorOptions,
  OverlayOptions,
} from '../react/index';

export {
  HydrationSnapshotScript,
  type HydrationSnapshotScriptProps,
} from './script';

export type { HydrationReport, HydrationCauseCategory } from '../core/types';
