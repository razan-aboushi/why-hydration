import type { Cause, Classifier, Divergence } from '../types';
import {
  differsOnlyByBidiControls,
  hasArabicIndicDigits,
  hasLatinDigits,
  isContentAttribute,
  isExtensionAttribute,
  isInvalidNesting,
  isRandomLike,
  isSameDateDifferentOrder,
  isSameNumberDifferentSeparators,
  looksLikeThirdPartyNode,
  looksLikeTime,
  messageIndicatesInvalidNesting,
  toTimestamp,
} from './detectors';
import { describe } from './messages';

export const DOCS_BASE =
  'https://github.com/razan-aboushi/why-hydration#cause-';

function docs(category: string): string {
  return `${DOCS_BASE}${category}`;
}

function bothDiffer(d: Divergence): d is Divergence & {
  server: string;
  client: string;
} {
  return (
    d.server != null && d.client != null && d.server.trim() !== d.client.trim()
  );
}

// The value-formatting rules (random / date / locale) only make sense for
// human-facing text: text nodes and content-like attributes. Applied to
// `class`/`style`/`id`/etc. they false-match (e.g. a class list with digits
// looks like "the same number with different separators").
function isValueDivergence(d: Divergence): boolean {
  if (d.kind === 'text') return true;
  if (d.kind === 'attribute' && d.attribute) {
    return isContentAttribute(d.attribute);
  }
  return false;
}

const nonDeterministic: Classifier = (d) => {
  if (!isValueDivergence(d)) return null;
  if (!bothDiffer(d)) return null;
  if (!isRandomLike(d.server) || !isRandomLike(d.client)) return null;
  return {
    category: 'non-deterministic-value',
    confidence: 0.9,
    ...describe('non-deterministic-value'),
    docsUrl: docs('non-deterministic-value'),
  };
};

const dateTime: Classifier = (d) => {
  if (!isValueDivergence(d)) return null;
  if (!bothDiffer(d)) return null;
  const serverTs = toTimestamp(d.server);
  const clientTs = toTimestamp(d.client);
  const bothTimes = looksLikeTime(d.server) && looksLikeTime(d.client);
  if (serverTs == null || clientTs == null) {
    if (!bothTimes) return null;
  }
  const delta =
    serverTs != null && clientTs != null ? Math.abs(serverTs - clientTs) : 0;
  const smallDelta = delta > 0 && delta < 24 * 60 * 60 * 1000;
  return {
    category: 'date-time',
    confidence: smallDelta || bothTimes ? 0.85 : 0.7,
    ...describe('date-time'),
    docsUrl: docs('date-time'),
  };
};

const localeFormat: Classifier = (d) => {
  if (!isValueDivergence(d)) return null;
  if (!bothDiffer(d)) return null;
  const { server, client } = d;

  // Checked first: the two values look identical in the console and in the
  // overlay, so nothing further down could explain the diff to the developer.
  if (differsOnlyByBidiControls(server, client)) {
    return {
      category: 'locale-format',
      confidence: 0.88,
      ...describe('locale-format.bidi'),
      docsUrl: docs('locale-format'),
    };
  }

  const scriptMismatch =
    (hasArabicIndicDigits(server) && hasLatinDigits(client)) ||
    (hasLatinDigits(server) && hasArabicIndicDigits(client));
  if (scriptMismatch) {
    return {
      category: 'locale-format',
      confidence: 0.92,
      ...describe('locale-format.script'),
      docsUrl: docs('locale-format'),
    };
  }

  if (isSameNumberDifferentSeparators(server, client)) {
    return {
      category: 'locale-format',
      confidence: 0.82,
      ...describe('locale-format.separators'),
      docsUrl: docs('locale-format'),
    };
  }

  if (isSameDateDifferentOrder(server, client)) {
    return {
      category: 'locale-format',
      confidence: 0.75,
      ...describe('locale-format.date-order'),
      docsUrl: docs('locale-format'),
    };
  }
  return null;
};

const browserOnlyApi: Classifier = (d) => {
  const serverEmpty = d.server == null || d.server.trim() === '';
  const clientHasContent = d.client != null && d.client.trim() !== '';
  const shape =
    (d.kind === 'text' || d.kind === 'node-added') &&
    serverEmpty &&
    clientHasContent;
  if (!shape) return null;
  return {
    category: 'browser-only-api',
    confidence: 0.75,
    ...describe('browser-only-api'),
    docsUrl: docs('browser-only-api'),
  };
};

const viewportBranching: Classifier = (d) => {
  const structural =
    d.kind === 'structure' ||
    d.kind === 'node-added' ||
    d.kind === 'node-removed';
  if (!structural) return null;
  if (
    isInvalidNesting(d.parentTagName, d.tagName) ||
    messageIndicatesInvalidNesting(d.reactMessage)
  ) {
    return null;
  }
  // A bare "hydration failed" message parses to a structure divergence with no
  // values and no tags. There is nothing there to attribute to a viewport
  // branch, so leave it unknown rather than inventing a 60%-confident cause.
  if (d.server == null && d.client == null && !d.tagName) return null;
  return {
    category: 'viewport-branching',
    confidence: 0.6,
    ...describe('viewport-branching'),
    docsUrl: docs('viewport-branching'),
  };
};

const invalidNesting: Classifier = (d) => {
  const byMessage = messageIndicatesInvalidNesting(d.reactMessage);
  const byShape = isInvalidNesting(d.parentTagName, d.tagName);
  if (!byMessage && !byShape) return null;
  return {
    category: 'invalid-html-nesting',
    confidence: byMessage ? 0.9 : 0.72,
    ...describe('invalid-html-nesting'),
    docsUrl: docs('invalid-html-nesting'),
  };
};

const whitespaceMinification: Classifier = (d) => {
  if (d.kind !== 'text') return null;
  if (d.server == null || d.client == null) return null;
  if (d.server === d.client) return null;
  const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (collapse(d.server) !== collapse(d.client)) return null;
  return {
    category: 'whitespace-minification',
    confidence: 0.7,
    ...describe('whitespace-minification'),
    docsUrl: docs('whitespace-minification'),
  };
};

const thirdPartyDomMutation: Classifier = (d) => {
  if (d.kind === 'attribute' && d.attribute) {
    if (isExtensionAttribute(d.attribute)) {
      return {
        category: 'third-party-dom-mutation',
        confidence: 0.88,
        ...describe('third-party-dom-mutation.extension-attribute', {
          attribute: d.attribute,
        }),
        docsUrl: docs('third-party-dom-mutation'),
      };
    }
    // Only when the diff actually resolved the <html>/<body> element. A
    // divergence parsed from a React message carries `body` as a placeholder
    // path, not a real location, so it must not be pinned to the root — every
    // client-only attribute anywhere on the page would look third-party.
    const el = d.element;
    const atRoot =
      d.server == null && el != null && /^(?:HTML|BODY)$/.test(el.tagName);
    if (atRoot) {
      return {
        category: 'third-party-dom-mutation',
        confidence: 0.6,
        ...describe('third-party-dom-mutation.root-attribute', {
          attribute: d.attribute,
        }),
        docsUrl: docs('third-party-dom-mutation'),
      };
    }
  }

  // An injected node (iframe/embed, or a known ads/consent/analytics/chat
  // marker) the server never rendered — not part of the app's hydration.
  if (
    (d.kind === 'node-added' || d.kind === 'node-removed') &&
    looksLikeThirdPartyNode(d.client ?? d.server, d.tagName)
  ) {
    const tag = (d.tagName ?? 'element').toLowerCase();
    return {
      category: 'third-party-dom-mutation',
      confidence: 0.7,
      ...describe('third-party-dom-mutation.injected-node', {
        tag: `<${tag}>`,
      }),
      docsUrl: docs('third-party-dom-mutation'),
    };
  }
  return null;
};

// Class / style / generic attribute mismatch that no value rule explained.
// This is where the `forceHide` class-toggle case lands, with the exact tokens.
const attributeMismatch: Classifier = (d) => {
  if (d.kind !== 'attribute' || !d.attribute) return null;
  const attr = d.attribute.toLowerCase();
  const server = d.server ?? '';
  const client = d.client ?? '';

  if (attr === 'class' || attr === 'classname') {
    const serverSet = new Set(server.split(/\s+/).filter(Boolean));
    const clientSet = new Set(client.split(/\s+/).filter(Boolean));
    const added = [...clientSet].filter((c) => !serverSet.has(c));
    const removed = [...serverSet].filter((c) => !clientSet.has(c));
    return {
      category: 'attribute-mismatch',
      confidence: 0.8,
      ...describe('attribute-mismatch.class', { added, removed }),
      docsUrl: docs('attribute-mismatch'),
    };
  }

  if (attr === 'style') {
    return {
      category: 'attribute-mismatch',
      confidence: 0.75,
      ...describe('attribute-mismatch.style'),
      docsUrl: docs('attribute-mismatch'),
    };
  }

  return {
    category: 'attribute-mismatch',
    confidence: 0.6,
    ...describe('attribute-mismatch.generic', {
      attribute: d.attribute,
      server,
      client,
    }),
    docsUrl: docs('attribute-mismatch'),
  };
};

export const BUILT_IN_RULES: readonly Classifier[] = [
  nonDeterministic,
  dateTime,
  localeFormat,
  // Third-party runs before browser-only/viewport so an injected iframe is
  // labelled correctly instead of "browser-only API" or "viewport branching".
  thirdPartyDomMutation,
  browserOnlyApi,
  viewportBranching,
  invalidNesting,
  whitespaceMinification,
  // Catch-all for class/style/generic attribute diffs — after the specific
  // rules so extension attributes and content values are handled first.
  attributeMismatch,
];

export const UNKNOWN_CAUSE: Cause = {
  category: 'unknown',
  confidence: 0,
  ...describe('unknown'),
  docsUrl: docs('unknown'),
};

/**
 * For a divergence with no values, no tag and no attribute — React's bare
 * "hydration failed" message with nothing parsed out of it. The generic
 * `UNKNOWN_CAUSE` tells the reader to "inspect the server vs client values
 * above", which is actively misleading when both are empty.
 */
export const UNKNOWN_NO_LOCATION_CAUSE: Cause = {
  category: 'unknown',
  confidence: 0,
  ...describe('unknown.no-location'),
  docsUrl: docs('unknown'),
};
