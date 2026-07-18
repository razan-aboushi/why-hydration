// Client-only entry: exports the provider hooks-based components. The
// `'use client'` directive is injected into the built output by
// scripts/postbuild-use-client.mjs. Import the server-rendered snapshot script
// from 'why-hydration/next/script' instead (it must stay a server component).
export { HydrationInspector, createHydrationInspector } from '../react/index';
export type {
  HydrationInspectorProps,
  HydrationInspectorHandle,
  InspectorOptions,
  OverlayOptions,
} from '../react/index';

export type { HydrationReport, HydrationCauseCategory } from '../core/types';
