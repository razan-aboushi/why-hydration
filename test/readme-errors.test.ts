/**
 * The README's "Searching for this error?" section quotes React's hydration
 * messages so people who paste an error into a search engine land on this
 * package. It also claims every one of them is recognized. This reads the
 * messages straight out of the README and holds the package to that claim, so
 * the list can never advertise a message the parser does not handle.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/classify';
import {
  isHydrationMessage,
  parseAllHydrationDivergences,
} from '../src/core/react-message';

function quotedMessages(): string[] {
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  const start = readme.indexOf('### Searching for this error?');
  const end = readme.indexOf('\n---', start);
  expect(start, 'section exists').toBeGreaterThan(0);
  const section = readme.slice(start, end);
  return [...section.matchAll(/```text\n([\s\S]*?)```/g)]
    .flatMap((m) => m[1]!.split('\n'))
    .map((l) => l.trim())
    .filter(Boolean);
}

describe('every error message the README advertises', () => {
  const messages = quotedMessages();

  it('lists the React 18 and React 19 messages', () => {
    expect(messages.length).toBeGreaterThanOrEqual(13);
  });

  it.each(messages)('is recognized: %s', (message) => {
    expect(isHydrationMessage(message)).toBe(true);
    expect(parseAllHydrationDivergences(message).length).toBeGreaterThan(0);
  });

  it('classifies the nesting messages as invalid nesting, in both formats', () => {
    for (const message of messages.filter((m) =>
      /cannot (?:be|appear as) a/.test(m),
    )) {
      const [d] = parseAllHydrationDivergences(message);
      expect(classify(d!).category, message).toBe('invalid-html-nesting');
    }
  });
});
