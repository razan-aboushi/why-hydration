export type DivergenceKind =
  'text' | 'attribute' | 'structure' | 'node-added' | 'node-removed';

export type HydrationCauseCategory =
  | 'non-deterministic-value'
  | 'date-time'
  | 'locale-format'
  | 'browser-only-api'
  | 'viewport-branching'
  | 'invalid-html-nesting'
  | 'whitespace-minification'
  | 'third-party-dom-mutation'
  | 'attribute-mismatch'
  | 'unknown';

export interface Divergence {
  kind: DivergenceKind;
  path: string;
  tagName?: string;
  parentTagName?: string;
  attribute?: string;
  reactMessage?: string;
  server: string | null;
  client: string | null;
  element?: Element | null;
}

export interface Cause {
  category: HydrationCauseCategory;
  confidence: number;
  /** Always English — this is what the console prints and `onReport` gets. */
  explanation: string;
  suggestion: string;
  docsUrl?: string;
  /**
   * Which message produced `explanation`/`suggestion`, so a renderer can show
   * the same cause in another language. Set by every built-in rule; custom
   * classifiers may leave it out, and renderers then fall back to the English.
   */
  messageId?: string;
  /** The values interpolated into that message (attribute names, tokens…). */
  params?: Readonly<Record<string, string | readonly string[]>>;
}

export type Classifier = (divergence: Divergence) => Cause | null;

export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
}

export interface HydrationReport {
  id: string;
  timestamp: number;
  component?: string;
  componentStack?: string;
  location?: SourceLocation;
  node: {
    path: string;
    tagName?: string;
    attribute?: string;
    kind: DivergenceKind;
  };
  server: string | null;
  client: string | null;
  cause: Cause;
  raw?: { reactMessage?: string };
}

export interface DetectionContext {
  componentStack?: string;
  component?: string;
  location?: SourceLocation;
  reactMessage?: string;
}
