/**
 * The words behind every built-in cause.
 *
 * A cause's `explanation` and `suggestion` are plain English strings — that is
 * what the console prints and what `onReport` receives, and they must stay
 * stable. But a renderer that wants to show the same cause in another language,
 * or lay it out right-to-left, cannot work from a finished string: it needs to
 * know which cause it is and which parts of the sentence are code or page data.
 *
 * So each message is written once, here, as a template, and a cause carries its
 * `messageId` and `params` alongside the rendered English. A template is either
 * a string or a function returning {@link MessageSegment}s:
 *
 *   - backtick spans    `useEffect`   → a `code` segment
 *   - `{name}` outside backticks       → a `value` segment (page data)
 *   - `{name}` inside backticks        → a `code` segment holding that param
 *
 * The distinction matters for bidi: code is always left-to-right, and page data
 * can be in any script, so a right-to-left renderer has to isolate both from
 * the sentence around them or their punctuation and brackets get reordered.
 */

export type MessageSegment =
  string | { readonly code: string } | { readonly value: string };

export type MessageParams = Readonly<
  Record<string, string | readonly string[]>
>;

export type MessageTemplate =
  string | ((params: MessageParams) => MessageSegment[]);

export interface MessageEntry {
  readonly explanation: MessageTemplate;
  readonly suggestion: MessageTemplate;
}

export type MessageId =
  | 'non-deterministic-value'
  | 'date-time'
  | 'locale-format.bidi'
  | 'locale-format.script'
  | 'locale-format.separators'
  | 'locale-format.date-order'
  | 'browser-only-api'
  | 'viewport-branching'
  | 'invalid-html-nesting'
  | 'whitespace-minification'
  | 'third-party-dom-mutation.extension-attribute'
  | 'third-party-dom-mutation.root-attribute'
  | 'third-party-dom-mutation.injected-node'
  | 'attribute-mismatch.class'
  | 'attribute-mismatch.style'
  | 'attribute-mismatch.generic'
  | 'unknown'
  | 'unknown.no-location';

/** A catalog must cover every id — the compiler enforces it per language. */
export type MessageCatalog = Readonly<Record<MessageId, MessageEntry>>;

export const code = (text: string): MessageSegment => ({ code: text });
export const value = (text: string): MessageSegment => ({ value: text });

export function param(params: MessageParams, name: string): string {
  const v = params[name];
  return typeof v === 'string' ? v : '';
}

export function paramList(
  params: MessageParams,
  name: string,
): readonly string[] {
  const v = params[name];
  return Array.isArray(v) ? v : [];
}

/** Each item becomes its own `value` segment, so each is isolated on render. */
export function valueList(
  items: readonly string[],
  separator: string,
): MessageSegment[] {
  const out: MessageSegment[] = [];
  items.forEach((item, i) => {
    if (i > 0) out.push(separator);
    out.push(value(item));
  });
  return out;
}

export function renderMessage(
  template: MessageTemplate,
  params: MessageParams = {},
): MessageSegment[] {
  if (typeof template === 'function') return template(params);
  const out: MessageSegment[] = [];
  template.split('`').forEach((part, i) => {
    if (i % 2 === 1) {
      out.push(
        code(part.replace(/\{(\w+)\}/g, (_, n: string) => param(params, n))),
      );
      return;
    }
    let last = 0;
    for (const m of part.matchAll(/\{(\w+)\}/g)) {
      const at = m.index ?? 0;
      if (at > last) out.push(part.slice(last, at));
      out.push(value(param(params, m[1]!)));
      last = at + m[0].length;
    }
    if (last < part.length) out.push(part.slice(last));
  });
  return out.filter((s) => s !== '');
}

/** The English string form: code keeps its backticks, values are inlined. */
export function plainText(segments: readonly MessageSegment[]): string {
  return segments
    .map((s) =>
      typeof s === 'string' ? s : 'code' in s ? `\`${s.code}\`` : s.value,
    )
    .join('');
}

/** The "(added on client: …; removed on client: …)" clause, per language. */
export function classDetail(
  params: MessageParams,
  words: {
    readonly added: string;
    readonly removed: string;
    readonly listSeparator: string;
    readonly partSeparator: string;
    readonly open: string;
    readonly close: string;
  },
): MessageSegment[] {
  const added = paramList(params, 'added');
  const removed = paramList(params, 'removed');
  if (!added.length && !removed.length) return [];
  const out: MessageSegment[] = [words.open];
  if (added.length) {
    out.push(words.added, ...valueList(added, words.listSeparator));
  }
  if (removed.length) {
    if (added.length) out.push(words.partSeparator);
    out.push(words.removed, ...valueList(removed, words.listSeparator));
  }
  out.push(words.close);
  return out;
}

export const EN_MESSAGES: MessageCatalog = {
  'non-deterministic-value': {
    explanation:
      'The server and client rendered different random-looking values ' +
      '(an id, token, or Math.random() output). Anything non-deterministic ' +
      'in render produces a different value on each side.',
    suggestion:
      'Use React `useId()` for ids. For random values, generate them after ' +
      'mount (in `useEffect`) or pass a value down from the server so both ' +
      'sides agree. Never call `Math.random()`/`crypto` during render.',
  },
  'date-time': {
    explanation:
      'The values are dates/times that differ between server render and ' +
      'client render — the clock moved (or the timezone differs) between the ' +
      'two environments.',
    suggestion:
      'Render the current time after mount, or pass a single server ' +
      'timestamp down and format it identically on both sides. Pin an ' +
      'explicit timezone when formatting.',
  },
  'locale-format.bidi': {
    explanation:
      'The values differ only by invisible bidirectional control marks ' +
      '(LRM/RLM/isolates). `Intl` adds these around numbers and dates in ' +
      'RTL locales, and different ICU versions — Node vs the browser — ' +
      'emit different ones for the same input.',
    suggestion:
      'Format the value in one place and pass the string down, or pin the ' +
      'same locale and timezone on both sides. If the marks are harmless, ' +
      'add `suppressHydrationWarning` to the element.',
  },
  'locale-format.script': {
    explanation:
      'The same value was formatted with different digit scripts ' +
      '(Arabic-Indic ٠١٢ vs Latin 012). The server and client resolved to ' +
      'different locales.',
    suggestion:
      'Pass an explicit `locale` (and timezone) to `Intl.NumberFormat` / ' +
      '`toLocaleString` on both server and client, or format the value ' +
      'after mount so only the client locale is ever used.',
  },
  'locale-format.separators': {
    explanation:
      'The same number was formatted with different grouping/decimal ' +
      'separators between server and client (e.g. 1,234.56 vs 1.234,56).',
    suggestion:
      'Pass an explicit locale to `Intl.NumberFormat`/`toLocaleString` on ' +
      'both sides so the separators match.',
  },
  'locale-format.date-order': {
    explanation:
      'The same date was rendered in a different field order ' +
      '(MM/DD vs DD/MM) between server and client.',
    suggestion:
      'Format dates with an explicit locale and timezone via `Intl` on ' +
      'both sides.',
  },
  'browser-only-api': {
    explanation:
      'The client rendered content the server left empty — the signature of ' +
      'reading a browser-only API (`window`, `document`, `localStorage`, ' +
      '`navigator`, `matchMedia`) during render.',
    suggestion:
      'Gate browser-only reads behind a mounted flag or `useEffect`, or use ' +
      '`useSyncExternalStore` with a server snapshot so the first client ' +
      'render matches the server.',
  },
  'viewport-branching': {
    explanation:
      'A whole subtree was added, removed, or swapped between server and ' +
      'client — typically a JavaScript width/viewport check that branches ' +
      'the tree at first render.',
    suggestion:
      'Render both branches and switch between them with CSS media queries at ' +
      'first paint instead of branching in JavaScript, or defer the ' +
      'JS-driven branch until after mount.',
  },
  'invalid-html-nesting': {
    explanation:
      'A node was moved or ejected because the markup is invalid HTML ' +
      '(e.g. a `<div>` inside a `<p>`, or nested `<a>`). The browser repairs ' +
      'the server DOM, so it no longer matches what React expects.',
    suggestion:
      'Fix the markup validity: block elements cannot live inside `<p>`, ' +
      'anchors cannot nest, etc. Replace the invalid parent with a `<div>` or ' +
      'restructure the tree.',
  },
  'whitespace-minification': {
    explanation:
      'The mismatch is whitespace-only — the text is identical apart from ' +
      'spaces/newlines. An HTML minifier likely collapsed whitespace around ' +
      'the hydration root differently from React.',
    suggestion:
      'Check your HTML minifier settings (e.g. `conservativeCollapse`) around ' +
      'the app root, or avoid minifying whitespace inside hydrated markup.',
  },
  'third-party-dom-mutation.extension-attribute': {
    explanation:
      'The attribute `{attribute}` was injected by a browser extension or ' +
      'third-party script (e.g. Grammarly, ColorZilla) before hydration, so ' +
      'the client DOM no longer matches the server.',
    suggestion:
      'This is usually harmless. Add `suppressHydrationWarning` to the ' +
      'affected element, or defer third-party script init until after ' +
      'hydration.',
  },
  'third-party-dom-mutation.root-attribute': {
    explanation:
      'An attribute (`{attribute}`) appeared on a root element that the ' +
      'server never sent — a hallmark of an extension or early third-party ' +
      'script mutating the DOM.',
    suggestion:
      'Add `suppressHydrationWarning` to the root element, or defer the ' +
      'third-party script until after hydration.',
  },
  'third-party-dom-mutation.injected-node': {
    explanation:
      'A {tag} was injected by a third-party script or browser extension ' +
      '(ads, consent, analytics, chat) after the server render. It is not ' +
      "part of your app's hydration, so this is usually harmless noise.",
    suggestion:
      'If React warns about it, add `suppressHydrationWarning` to the ' +
      'nearest server-rendered wrapper, or load the third-party script after ' +
      'hydration (e.g. Next.js `<Script strategy="afterInteractive">`).',
  },
  'attribute-mismatch.class': {
    explanation: (p) => [
      'The ',
      code('class'),
      ' differs between server and client',
      ...classDetail(p, {
        added: 'added on client: ',
        removed: 'removed on client: ',
        listSeparator: ', ',
        partSeparator: '; ',
        open: ' (',
        close: ')',
      }),
      '. A class was applied conditionally on the client — commonly a ' +
        'viewport, media-query, theme, or feature-flag check that runs during ' +
        'the first render.',
    ],
    suggestion:
      'Render the same className on the server and the first client paint. ' +
      'Move client-only conditions into `useEffect`/a mounted flag, or drive ' +
      'the visual change with CSS media queries instead of a JS class toggle.',
  },
  'attribute-mismatch.style': {
    explanation:
      'The inline `style` differs between server and client — an inline ' +
      'style was computed from client-only state (viewport size, theme, ' +
      'scroll position) during render.',
    suggestion:
      'Compute the style after mount (`useEffect`) so the first client render ' +
      'matches the server, or move it to a CSS class / media query.',
  },
  'attribute-mismatch.generic': {
    explanation:
      'The `{attribute}` attribute differs between server (`{server}`) ' +
      'and client (`{client}`) — its value was derived from something that ' +
      'differs between the server and the first client render.',
    suggestion:
      'Make the attribute deterministic across server and client, or set it ' +
      'after mount so the first client render matches the server HTML.',
  },
  unknown: {
    explanation:
      'A hydration mismatch was detected but could not be matched to a known ' +
      'cause. Inspect the server vs client values above.',
    suggestion:
      'Compare the server and client values. Common causes are ' +
      'non-deterministic values, dates/locales, and browser-only APIs used ' +
      'during render.',
  },
  'unknown.no-location': {
    explanation:
      'React reported that hydration failed but did not say which node ' +
      'differed, and the DOM diff found no difference to point at.',
    suggestion:
      'Make sure `<HydrationSnapshotScript>` (or the manual snapshot script) ' +
      "is in `<head>` so the DOM diff can locate the node, and read React's " +
      'full warning in the browser console.',
  },
};

/** Everything a rule needs to put on a {@link Cause} for one message. */
export function describe(
  id: MessageId,
  params: MessageParams = {},
  catalog: MessageCatalog = EN_MESSAGES,
): {
  messageId: MessageId;
  params?: MessageParams;
  explanation: string;
  suggestion: string;
} {
  const entry = catalog[id];
  return {
    messageId: id,
    ...(Object.keys(params).length ? { params } : {}),
    explanation: plainText(renderMessage(entry.explanation, params)),
    suggestion: plainText(renderMessage(entry.suggestion, params)),
  };
}
