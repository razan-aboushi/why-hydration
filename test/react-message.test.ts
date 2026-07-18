import { describe, expect, it } from 'vitest';
import {
  extractComponentFromMessage,
  formatConsoleArgs,
  isHydrationMessage,
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
});
