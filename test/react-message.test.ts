import { describe, expect, it } from 'vitest';
import {
  extractComponentFromMessage,
  formatConsoleArgs,
  isHydrationMessage,
  parseAllHydrationDivergences,
  parseHydrationMessage,
} from '../src/core/react-message';

// The exact modern React 18.3+/19 hydration diff format (from a real Next app).
const MODERN_MESSAGE = `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up.

  ...
    <ClientPageRoot Component={function Page}>
      <Page params={Promise} searchParams={Promise}>
        <main style={{padding:40}}>
          <p>
            <PriceTag>
              <span
+               className="radius-8 border ripple p-8 noWrap pointer blueColor forceHide"
-               className="radius-8 border ripple p-8 noWrap pointer blueColor"
              >
+               1,400 KWD
  ...`;

describe('react-message', () => {
  it('reconstructs printf-style console args', () => {
    expect(
      formatConsoleArgs([
        'Warning: Text content did not match. Server: "%s" Client: "%s"',
        'foo',
        'bar',
      ]),
    ).toBe('Warning: Text content did not match. Server: "foo" Client: "bar"');
  });

  it('recognizes hydration messages', () => {
    expect(isHydrationMessage('Hydration failed because ...')).toBe(true);
    expect(isHydrationMessage('Some unrelated warning')).toBe(false);
  });

  it('parses a text mismatch', () => {
    const d = parseHydrationMessage(
      'Warning: Text content did not match. Server: "10:00" Client: "10:01"',
    );
    expect(d?.kind).toBe('text');
    expect(d?.server).toBe('10:00');
    expect(d?.client).toBe('10:01');
  });

  it('parses a prop mismatch', () => {
    const d = parseHydrationMessage(
      'Warning: Prop `className` did not match. Server: "a" Client: "b"',
    );
    expect(d?.kind).toBe('attribute');
    expect(d?.attribute).toBe('className');
  });

  // Every message React actually emits ends with a component stack. Anchoring
  // the value regexes to end-of-string meant none of them ever matched.
  describe('real React 18 console output', () => {
    it('parses a text mismatch followed by a component stack', () => {
      const d = parseHydrationMessage(
        'Warning: Text content did not match. Server: "AAA" Client: "BBB"\n    at span\n    at div',
      );
      expect(d?.kind).toBe('text');
      expect(d?.server).toBe('AAA');
      expect(d?.client).toBe('BBB');
    });

    it('parses a prop mismatch followed by a component stack', () => {
      const d = parseHydrationMessage(
        'Warning: Prop `className` did not match. Server: "price" Client: "price forceHide"\n    at div',
      );
      expect(d?.kind).toBe('attribute');
      expect(d?.attribute).toBe('className');
      expect(d?.server).toBe('price');
      expect(d?.client).toBe('price forceHide');
    });

    it('reconstructs the printf form React passes to console.error', () => {
      const message = formatConsoleArgs([
        'Warning: Prop `%s` did not match. Server: %s Client: %s%s',
        'className',
        '"price"',
        '"price forceHide"',
        '\n    at div',
      ]);
      const d = parseHydrationMessage(message);
      expect(d?.attribute).toBe('className');
      expect(d?.server).toBe('price');
      expect(d?.client).toBe('price forceHide');
    });

    // React emits these alongside the real warning; they describe the
    // consequence, not the divergence, so there is nothing to parse out.
    it.each([
      'Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>.',
      'Error: Text content does not match server-rendered HTML.',
      'Error: There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.',
    ])('yields no values for the follow-up message %#', (message) => {
      const d = parseHydrationMessage(message);
      expect(d?.server).toBeNull();
      expect(d?.client).toBeNull();
      expect(d?.tagName).toBeUndefined();
    });
  });

  it('parses invalid nesting', () => {
    const d = parseHydrationMessage(
      'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
    );
    expect(d?.kind).toBe('structure');
    expect(d?.tagName).toBe('DIV');
    expect(d?.parentTagName).toBe('P');
  });

  it('returns null for non-hydration messages', () => {
    expect(parseHydrationMessage('Warning: something else')).toBeNull();
  });

  describe('modern React 18.3+/19 diff format', () => {
    it('is recognized as a hydration message', () => {
      expect(isHydrationMessage(MODERN_MESSAGE)).toBe(true);
    });

    it('parses the changed attribute + both values from the diff', () => {
      const d = parseHydrationMessage(MODERN_MESSAGE);
      expect(d?.kind).toBe('attribute');
      expect(d?.attribute).toBe('className');
      expect(d?.client).toContain('forceHide');
      expect(d?.server).not.toContain('forceHide');
    });

    it('extracts the nearest user component, skipping Next internals', () => {
      expect(extractComponentFromMessage(MODERN_MESSAGE)).toBe('PriceTag');
    });
  });

  // React prints one `+`/`-` pair per attribute only when both sides rendered
  // it. An attribute present on just one side gets a single line, which used to
  // be discarded: the pairing loop skipped it and the text pass filtered it out.
  describe('parseAllHydrationDivergences', () => {
    // React pads the +/- marker out to the tree's indentation, so a real diff
    // line always has several spaces after the marker. Reproduce that here:
    // a single space is what React's prose bullet list uses, and the parser
    // must be able to tell them apart.
    const tree = (lines: string): string =>
      [
        "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.",
        '',
        '  <span',
        ...lines
          .split('\n')
          .map((l) => l.replace(/^([+-]) /, '$1   ').padStart(0)),
        '  >',
      ].join('\n');

    it('pairs the two sides of one changed attribute', () => {
      const found = parseAllHydrationDivergences(
        tree('+ className="b"\n- className="a"'),
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        kind: 'attribute',
        attribute: 'className',
        server: 'a',
        client: 'b',
      });
    });

    it('keeps an attribute only the server rendered', () => {
      const found = parseAllHydrationDivergences(tree('- data-server="1"'));
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        kind: 'attribute',
        attribute: 'data-server',
        server: '1',
        client: null,
      });
    });

    it('keeps an attribute only the client rendered', () => {
      const found = parseAllHydrationDivergences(tree('+ data-client="1"'));
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        kind: 'attribute',
        attribute: 'data-client',
        server: null,
        client: '1',
      });
    });

    it('reports every changed attribute in a single diff tree', () => {
      const found = parseAllHydrationDivergences(
        tree('+ className="b"\n- className="a"\n- id="gone"\n+ title="new"'),
      );
      expect(found.map((d) => d.attribute).sort()).toEqual([
        'className',
        'id',
        'title',
      ]);
    });

    // Captured verbatim from react-dom 19 hydrating a className mismatch in
    // jsdom. The prose bullet list is the trap: five lines starting with "- ".
    const REACT_19_MESSAGE =
      "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:\n" +
      '\n' +
      "- A server/client branch `if (typeof window !== 'undefined')`.\n" +
      "- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.\n" +
      "- Date formatting in a user's locale which doesn't match the server.\n" +
      '- External changing data without sending a snapshot of it along with the HTML.\n' +
      '- Invalid HTML tag nesting.\n' +
      '\n' +
      'It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.\n' +
      '\n' +
      'https://react.dev/link/hydration-mismatch\n' +
      '\n' +
      '  <div\n' +
      '+   className="price forceHide"\n' +
      '-   className="price"\n' +
      '  >\n' +
      '+   10';

    it('does not mistake React 19 help bullets for server values', () => {
      const found = parseAllHydrationDivergences(REACT_19_MESSAGE);
      const servers = found.map((d) => d.server ?? '');
      expect(servers.join(' ')).not.toContain('Invalid HTML tag nesting');
      expect(servers.join(' ')).not.toContain('Date formatting');
      expect(servers.join(' ')).not.toContain('server/client branch');
    });

    it('extracts only the real change from a React 19 message', () => {
      // The trailing "+   10" is the element's unchanged text, echoed as
      // context for the attribute that did change. The server rendered it too.
      const found = parseAllHydrationDivergences(REACT_19_MESSAGE);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        kind: 'attribute',
        attribute: 'className',
        server: 'price',
        client: 'price forceHide',
      });
    });

    it('parses React 18 output verbatim, component stack and all', () => {
      // Captured from a real hydrateRoot in jsdom. React always appends the
      // stack after the values; anchoring the value regexes to end-of-string
      // meant no real message ever matched and both values were lost.
      const found = parseAllHydrationDivergences(
        'Warning: Text content did not match. Server: "AAA" Client: "BBB"\n    at span\n    at div',
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        kind: 'text',
        server: 'AAA',
        client: 'BBB',
      });
    });

    it('still extracts the attribute change from a real message', () => {
      const found = parseAllHydrationDivergences(MODERN_MESSAGE);
      const attr = found.find((d) => d.attribute === 'className');
      expect(attr?.client).toContain('forceHide');
      expect(attr?.server).not.toContain('forceHide');
    });

    it('does not report the price text that never changed', () => {
      // "+ 1,400 KWD" is context for the className change on the <span>
      // wrapping it. Reading it as "the server rendered nothing" reported a
      // browser-only API call on top of every real attribute mismatch.
      const found = parseAllHydrationDivergences(MODERN_MESSAGE);
      expect(found.filter((d) => d.kind === 'text')).toEqual([]);
    });

    it('still reports a genuine text change, which has both sides', () => {
      const found = parseAllHydrationDivergences(
        tree('- 10:00 AM\n+ 10:01 AM'),
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        kind: 'text',
        server: '10:00 AM',
        client: '10:01 AM',
      });
    });
  });
});
