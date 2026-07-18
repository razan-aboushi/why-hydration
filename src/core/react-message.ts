import type { Divergence } from './types';

export function isHydrationMessage(message: string): boolean {
  return (
    /hydrat/i.test(message) ||
    /did(?:n't| not) match/i.test(message) ||
    /won't be patched up/i.test(message) ||
    /hydration-mismatch/i.test(message) ||
    /server (?:HTML|rendered)/i.test(message) ||
    /validateDOMNesting/i.test(message) ||
    /Text content does not match/i.test(message)
  );
}

function stringify(v: unknown): string {
  return typeof v === 'string' ? v : String(v);
}

export function formatConsoleArgs(args: readonly unknown[]): string {
  if (args.length === 0) return '';
  const [first, ...rest] = args;
  if (typeof first === 'string' && /%[sco]/.test(first)) {
    let i = 0;
    const expanded = first.replace(/%[sco]/g, () => stringify(rest[i++] ?? ''));
    const leftover = rest.slice(i).map(stringify).filter(Boolean);
    return [expanded, ...leftover].join('\n').trim();
  }
  return args.map(stringify).join(' ');
}

// Next.js / React internal components we never want to name as the culprit.
function isInternalComponent(name: string): boolean {
  return (
    /^(Inner|Outer|Segment|Client|Server|Redirect|Error|Loading|HTTPAccess|RenderFrom|ScrollAndFocus|Metadata|Outlet|ViewTransition|NotFound|Hot|DevRoot|App)$/.test(
      name,
    ) ||
    /^(Inner|Outer|Segment|Client|Server|Redirect|Error|Loading|HTTPAccess|RenderFrom|ScrollAndFocus|Metadata|Outlet|ViewTransition|NotFound|Hot|DevRoot)[A-Z]/.test(
      name,
    ) ||
    /(Boundary|Router|Handler|Provider|Context|Root|Node)$/.test(name) ||
    name === 'Fragment' ||
    name === 'Suspense'
  );
}

/** The nearest user component named in a React hydration diff tree. */
export function extractComponentFromMessage(
  message: string,
): string | undefined {
  const names: string[] = [];
  const re = /<([A-Z][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    const name = m[1];
    if (name && !isInternalComponent(name)) names.push(name);
  }
  return names.length ? names[names.length - 1] : undefined;
}

const ATTR_RE = /^([\w:-]+)=(?:"([\s\S]*)"|\{([\s\S]*)\})$/;

/**
 * Modern React (18.3+/19) prints hydration mismatches as a JSX diff tree with
 * `+` (client) and `-` (server) lines. This extracts the changed attribute or
 * text and both values.
 */
function parseModernDiff(message: string): Divergence | null {
  const plus: string[] = [];
  const minus: string[] = [];
  for (const raw of message.split('\n')) {
    const line = raw.trim();
    const p = /^\+\s+(.+)$/.exec(line);
    const mn = /^-\s+(.+)$/.exec(line);
    if (p && p[1]) plus.push(p[1].trim());
    else if (mn && mn[1]) minus.push(mn[1].trim());
  }
  if (plus.length === 0 && minus.length === 0) return null;

  // Prefer a matching attribute pair (same attribute on + and -).
  for (const p of plus) {
    const pm = ATTR_RE.exec(p);
    if (!pm) continue;
    const name = pm[1];
    const clientValue = pm[2] ?? pm[3] ?? '';
    const matched = minus.find((mm) => {
      const parsed = ATTR_RE.exec(mm);
      return parsed && parsed[1] === name;
    });
    if (matched) {
      const parsed = ATTR_RE.exec(matched);
      const serverValue = parsed ? (parsed[2] ?? parsed[3] ?? '') : '';
      return {
        kind: 'attribute',
        path: 'body',
        attribute: name,
        server: serverValue,
        client: clientValue,
        reactMessage: message,
      };
    }
  }

  // Otherwise a text/content change: pick the non-attribute lines.
  const client = plus.find((p) => !ATTR_RE.test(p)) ?? null;
  const server = minus.find((m) => !ATTR_RE.test(m)) ?? null;
  if (client !== null || server !== null) {
    return {
      kind: 'text',
      path: 'body',
      server,
      client,
      reactMessage: message,
    };
  }
  return null;
}

export function parseHydrationMessage(message: string): Divergence | null {
  if (!isHydrationMessage(message)) return null;

  // Invalid nesting is reported as its own message in every React version.
  const nesting =
    /<(\w+)>\s*cannot (?:appear as a|be a|contain a) (?:child|descendant)/i.exec(
      message,
    );
  if (nesting || /validateDOMNesting/i.test(message)) {
    const pair =
      /<(\w+)>\s*cannot (?:appear as a|be a) (?:child|descendant) of <?(\w+)>?/i.exec(
        message,
      );
    return {
      kind: 'structure',
      path: 'body',
      tagName: pair ? pair[1]?.toUpperCase() : undefined,
      parentTagName: pair ? pair[2]?.toUpperCase() : undefined,
      server: null,
      client: null,
      reactMessage: message,
    };
  }

  // Modern diff-tree format (React 18.3+/19).
  const modern = parseModernDiff(message);
  if (modern) return modern;

  // Legacy explicit formats (React <18.3).
  const text =
    /Text content (?:did not match|does not match)[^:]*Server:\s*"?(.*?)"?\s+Client:\s*"?(.*?)"?\s*$/i.exec(
      message,
    );
  if (text) {
    return {
      kind: 'text',
      path: 'body',
      server: text[1] ?? null,
      client: text[2] ?? null,
      reactMessage: message,
    };
  }

  const prop =
    /Prop [`'"]([^`'"]+)[`'"] did not match\.?\s*Server:\s*"?(.*?)"?\s+Client:\s*"?(.*?)"?\s*$/i.exec(
      message,
    );
  if (prop) {
    return {
      kind: 'attribute',
      path: 'body',
      attribute: prop[1],
      server: prop[2] ?? null,
      client: prop[3] ?? null,
      reactMessage: message,
    };
  }

  const expected =
    /Expected server HTML to contain a matching <(\w+)>(?: in <(\w+)>)?/i.exec(
      message,
    );
  if (expected) {
    return {
      kind: 'node-added',
      path: 'body',
      tagName: expected[1]?.toUpperCase(),
      parentTagName: expected[2]?.toUpperCase(),
      server: null,
      client: `<${expected[1]?.toLowerCase()}>`,
      reactMessage: message,
    };
  }
  const notExpected =
    /Did not expect server HTML to contain(?: the text node)?(?: a)? <?(\w+)>?/i.exec(
      message,
    );
  if (notExpected) {
    return {
      kind: 'node-removed',
      path: 'body',
      tagName: notExpected[1]?.toUpperCase(),
      server: `<${notExpected[1]?.toLowerCase()}>`,
      client: null,
      reactMessage: message,
    };
  }

  return {
    kind: 'structure',
    path: 'body',
    server: null,
    client: null,
    reactMessage: message,
  };
}
