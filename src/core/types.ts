/**
 * Public and internal type definitions for why-hydration.
 *
 * The types here are shared across every layer (snapshot → diff → classifier →
 * reporter) and every entry point. Keeping them in one dependency-free module
 * means the core engine stays framework-agnostic.
 */

/** The kind of divergence found between the server DOM and the client DOM. */
export type DivergenceKind =
  | 'text'
  | 'attribute'
  | 'structure'
  | 'node-added'
  | 'node-removed';

/** The categories the classifier can assign to a divergence. */
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

/**
 * A single located difference between server and client trees, before it has
 * been classified. This is the classifier's input.
 */
export interface Divergence {
  kind: DivergenceKind;
  /** A stable, human-readable selector-style path to the node. */
  path: string;
  /** Tag name of the node (or the nearest element), upper-cased by the DOM. */
  tagName?: string;
  /** Tag name of the parent element, upper-cased. Used e.g. to spot `<div>` in `<p>`. */
  parentTagName?: string;
  /** For `attribute` divergences, the name of the differing attribute. */
  attribute?: string;
  /**
   * The raw React dev-mode hydration message, when the divergence was derived
   * from (or corroborated by) console interception. Some categories (invalid
   * HTML nesting) are only reliably visible in this message.
   */
  reactMessage?: string;
  /** The server-rendered value (text / attribute value / serialized node). */
  server: string | null;
  /** The client-rendered value. */
  client: string | null;
  /** The live client element nearest the divergence, when available. */
  element?: Element | null;
}

/** The classifier's verdict for a divergence. */
export interface Cause {
  category: HydrationCauseCategory;
  /** 0–1. Higher means the rule is more sure. */
  confidence: number;
  explanation: string;
  suggestion: string;
  docsUrl?: string;
}

/**
 * A classifier rule. Return `null` to abstain; the next rule is then tried.
 * Custom rules supplied via `classify` run before the built-ins.
 */
export type Classifier = (divergence: Divergence) => Cause | null;

/** Source location for the offending component, best-effort. */
export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
}

/** The complete, public report emitted for one hydration mismatch. */
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

/** Extra signals the detection layer can attach to a divergence. */
export interface DetectionContext {
  componentStack?: string;
  component?: string;
  location?: SourceLocation;
  reactMessage?: string;
}
