/**
 * `why-hydration` — core engine (framework-agnostic).
 *
 * This entry is pure: importing it has no side effects and every export is a
 * function or type, so anything you don't use tree-shakes away. Framework
 * adapters (`why-hydration/react`, `why-hydration/next`) build on top of this.
 */

export type {
  Cause,
  Classifier,
  DetectionContext,
  Divergence,
  DivergenceKind,
  HydrationCauseCategory,
  HydrationReport,
  SourceLocation,
} from './core/types';

export { isDev } from './core/env';

export {
  DEFAULT_SNAPSHOT_SELECTORS,
  SNAPSHOT_KEY,
  captureSnapshotNow,
  getServerHtmlForRoot,
  getSnapshotScriptSource,
  readSnapshot,
  type Snapshot,
} from './core/snapshot';

export {
  diffSnapshotAgainstDom,
  diffTrees,
  parseServerHtml,
} from './core/diff';

export {
  BUILT_IN_RULES,
  CONFIDENCE_THRESHOLD,
  UNKNOWN_CAUSE,
  classify,
  type ClassifyOptions,
} from './core/classify';

export {
  ReportCollector,
  buildReport,
  signatureOf,
  type CollectorOptions,
  type ReportSink,
} from './core/report';

export { inspectRoot, reportFromMessage } from './core/inspect';

export {
  formatConsoleArgs,
  isHydrationMessage,
  parseHydrationMessage,
} from './core/react-message';
