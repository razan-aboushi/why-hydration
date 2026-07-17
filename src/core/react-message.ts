/**
 * Parse React's dev-mode hydration warnings into a {@link Divergence}.
 *
 * Where we don't control `hydrateRoot` (Next.js App/Pages), the most reliable
 * signal is the detail React already computed and printed to `console.error`.
 * This module reconstructs the formatted message from the raw `console.error`
 * arguments and extracts the structured mismatch. Framework-agnostic string
 * work, so it lives in core.
 */

import type { Divergence } from './types';

/** True when a formatted console message is a React hydration warning. */
export function isHydrationMessage(message: string): boolean {
  return (
    /hydrat/i.test(message) ||
    /did not match/i.test(message) ||
    /server (?:HTML|rendered)/i.test(message) ||
    /validateDOMNesting/i.test(message) ||
    /Text content does not match/i.test(message)
  );
}

/** Reconstruct the printed string from raw `console.error(format, ...args)`. */
export function formatConsoleArgs(args: readonly unknown[]): string {
  if (args.length === 0) return '';
  const [first, ...rest] = args;
  if (typeof first === 'string' && /%[sco]/.test(first)) {
    let i = 0;
    return first.replace(/%[sco]/g, () => String(rest[i++] ?? '')).trim();
  }
  return args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
}

/**
 * Parse a formatted React hydration message into a partial divergence.
 * Returns `null` when the message isn't a recognized hydration warning.
 */
export function parseHydrationMessage(message: string): Divergence | null {
  if (!isHydrationMessage(message)) return null;

  // Text content mismatch (React 18 & 19 variants).
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

  // Prop / attribute mismatch.
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

  // Invalid nesting.
  const nesting =
    /<(\w+)>\s*cannot (?:appear as a|be a) (?:child|descendant) of <?(\w+)>?/i.exec(
      message,
    );
  if (nesting || /validateDOMNesting/i.test(message)) {
    return {
      kind: 'structure',
      path: 'body',
      tagName: nesting ? nesting[1]?.toUpperCase() : undefined,
      parentTagName: nesting ? nesting[2]?.toUpperCase() : undefined,
      server: null,
      client: null,
      reactMessage: message,
    };
  }

  // Missing/extra element ("Expected server HTML to contain a matching <X>").
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

  // Recognized as hydration-related but no structured detail — still useful.
  return {
    kind: 'structure',
    path: 'body',
    server: null,
    client: null,
    reactMessage: message,
  };
}
