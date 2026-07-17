export type DivergenceKind =
  | 'text'
  | 'attribute'
  | 'structure'
  | 'node-added'
  | 'node-removed';

export type HydrationCauseCategory =
  | 'non-deterministic-value'
  | 'date-time'
  | 'locale-format'
  | 'browser-only-api'
  | 'viewport-branching'
  | 'invalid-html-nesting'
  | 'whitespace-minification'
  | 'third-party-dom-mutation'
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
  explanation: string;
  suggestion: string;
  docsUrl?: string;
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
