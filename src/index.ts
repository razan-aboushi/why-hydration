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
