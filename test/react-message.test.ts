import { describe, expect, it } from 'vitest';
import {
  formatConsoleArgs,
  isHydrationMessage,
  parseHydrationMessage,
} from '../src/core/react-message';

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
});
