import type { Cause, Classifier, Divergence } from '../types';
import {
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
    explanation:
      'The server and client rendered different random-looking values ' +
      '(an id, token, or Math.random() output). Anything non-deterministic ' +
      'in render produces a different value on each side.',
    suggestion:
      'Use React `useId()` for ids. For random values, generate them after ' +
      'mount (in `useEffect`) or pass a value down from the server so both ' +
      'sides agree. Never call `Math.random()`/`crypto` during render.',
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
    explanation:
      'The values are dates/times that differ between server render and ' +
      'client render — the clock moved (or the timezone differs) between the ' +
      'two environments.',
    suggestion:
      'Render the current time after mount, or pass a single server ' +
      'timestamp down and format it identically on both sides. Pin an ' +
      'explicit timezone when formatting.',
    docsUrl: docs('date-time'),
  };
};

const localeFormat: Classifier = (d) => {
  if (!isValueDivergence(d)) return null;
  if (!bothDiffer(d)) return null;
  const { server, client } = d;

  const scriptMismatch =
    (hasArabicIndicDigits(server) && hasLatinDigits(client)) ||
    (hasLatinDigits(server) && hasArabicIndicDigits(client));
  if (scriptMismatch) {
    return {
      category: 'locale-format',
      confidence: 0.92,
      explanation:
        'The same value was formatted with different digit scripts ' +
        '(Arabic-Indic ٠١٢ vs Latin 012). The server and client resolved to ' +
        'different locales.',
      suggestion:
        'Pass an explicit `locale` (and timezone) to `Intl.NumberFormat` / ' +
        '`toLocaleString` on both server and client, or format the value ' +
        'after mount so only the client locale is ever used.',
      docsUrl: docs('locale-format'),
    };
  }

  if (isSameNumberDifferentSeparators(server, client)) {
    return {
      category: 'locale-format',
      confidence: 0.82,
      explanation:
        'The same number was formatted with different grouping/decimal ' +
        'separators between server and client (e.g. 1,234.56 vs 1.234,56).',
      suggestion:
        'Pass an explicit locale to `Intl.NumberFormat`/`toLocaleString` on ' +
        'both sides so the separators match.',
      docsUrl: docs('locale-format'),
    };
  }

  if (isSameDateDifferentOrder(server, client)) {
    return {
      category: 'locale-format',
      confidence: 0.75,
      explanation:
        'The same date was rendered in a different field order ' +
        '(MM/DD vs DD/MM) between server and client.',
      suggestion:
        'Format dates with an explicit locale and timezone via `Intl` on ' +
        'both sides.',
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
    explanation:
      'The client rendered content the server left empty — the signature of ' +
      'reading a browser-only API (`window`, `document`, `localStorage`, ' +
      '`navigator`, `matchMedia`) during render.',
    suggestion:
      'Gate browser-only reads behind a mounted flag or `useEffect`, or use ' +
      '`useSyncExternalStore` with a server snapshot so the first client ' +
      'render matches the server.',
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
  return {
    category: 'viewport-branching',
    confidence: 0.6,
    explanation:
      'A whole subtree was added, removed, or swapped between server and ' +
      'client — typically a JavaScript width/viewport check that branches ' +
      'the tree at first render.',
    suggestion:
      'Render both branches and switch between them with CSS media queries at ' +
      'first paint instead of branching in JavaScript, or defer the ' +
      'JS-driven branch until after mount.',
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
    explanation:
      'A node was moved or ejected because the markup is invalid HTML ' +
      '(e.g. a `<div>` inside a `<p>`, or nested `<a>`). The browser repairs ' +
      'the server DOM, so it no longer matches what React expects.',
    suggestion:
      'Fix the markup validity: block elements cannot live inside `<p>`, ' +
      'anchors cannot nest, etc. Replace the invalid parent with a `<div>` or ' +
      'restructure the tree.',
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
    explanation:
      'The mismatch is whitespace-only — the text is identical apart from ' +
      'spaces/newlines. An HTML minifier likely collapsed whitespace around ' +
      'the hydration root differently from React.',
    suggestion:
      'Check your HTML minifier settings (e.g. `conservativeCollapse`) around ' +
      'the app root, or avoid minifying whitespace inside hydrated markup.',
    docsUrl: docs('whitespace-minification'),
  };
};

const thirdPartyDomMutation: Classifier = (d) => {
  if (d.kind === 'attribute' && d.attribute) {
    if (isExtensionAttribute(d.attribute)) {
      return {
        category: 'third-party-dom-mutation',
        confidence: 0.88,
        explanation:
          `The attribute \`${d.attribute}\` was injected by a browser ` +
          'extension or third-party script (e.g. Grammarly, ColorZilla) ' +
          'before hydration, so the client DOM no longer matches the server.',
        suggestion:
          'This is usually harmless. Add `suppressHydrationWarning` to the ' +
          'affected element, or defer third-party script init until after ' +
          'hydration.',
        docsUrl: docs('third-party-dom-mutation'),
      };
    }
    const atRoot = /^(html|body)\b/.test(d.path) && d.server == null;
    if (atRoot) {
      return {
        category: 'third-party-dom-mutation',
        confidence: 0.6,
        explanation:
          `An attribute (\`${d.attribute}\`) appeared on a root element that ` +
          'the server never sent — a hallmark of an extension or early ' +
          'third-party script mutating the DOM.',
        suggestion:
          'Add `suppressHydrationWarning` to the root element, or defer the ' +
          'third-party script until after hydration.',
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
      explanation:
        `A <${tag}> was injected by a third-party script or browser extension ` +
        '(ads, consent, analytics, chat) after the server render. It is not ' +
        "part of your app's hydration, so this is usually harmless noise.",
      suggestion:
        'If React warns about it, add `suppressHydrationWarning` to the ' +
        'nearest server-rendered wrapper, or load the third-party script after ' +
        'hydration (e.g. Next.js `<Script strategy="afterInteractive">`).',
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
    const parts: string[] = [];
    if (added.length) parts.push(`added on client: ${added.join(', ')}`);
    if (removed.length) parts.push(`removed on client: ${removed.join(', ')}`);
    const detail = parts.length ? ` (${parts.join('; ')})` : '';
    return {
      category: 'attribute-mismatch',
      confidence: 0.8,
      explanation:
        `The \`class\` differs between server and client${detail}. A class was ` +
        'applied conditionally on the client — commonly a viewport, media-query, ' +
        'theme, or feature-flag check that runs during the first render.',
      suggestion:
        'Render the same className on the server and the first client paint. ' +
        'Move client-only conditions into `useEffect`/a mounted flag, or drive ' +
        'the visual change with CSS media queries instead of a JS class toggle.',
      docsUrl: docs('attribute-mismatch'),
    };
  }

  if (attr === 'style') {
    return {
      category: 'attribute-mismatch',
      confidence: 0.75,
      explanation:
        'The inline `style` differs between server and client — an inline ' +
        'style was computed from client-only state (viewport size, theme, ' +
        'scroll position) during render.',
      suggestion:
        'Compute the style after mount (`useEffect`) so the first client render ' +
        'matches the server, or move it to a CSS class / media query.',
      docsUrl: docs('attribute-mismatch'),
    };
  }

  return {
    category: 'attribute-mismatch',
    confidence: 0.6,
    explanation:
      `The \`${d.attribute}\` attribute differs between server (\`${server}\`) ` +
      `and client (\`${client}\`) — its value was derived from something that ` +
      'differs between the server and the first client render.',
    suggestion:
      'Make the attribute deterministic across server and client, or set it ' +
      'after mount so the first client render matches the server HTML.',
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
  explanation:
    'A hydration mismatch was detected but could not be matched to a known ' +
    'cause. Inspect the server vs client values above.',
  suggestion:
    'Compare the server and client values. Common causes are ' +
    'non-deterministic values, dates/locales, and browser-only APIs used ' +
    'during render.',
  docsUrl: docs('unknown'),
};
