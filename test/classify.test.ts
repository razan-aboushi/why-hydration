import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/classify';
import type { Classifier, Divergence } from '../src/core/types';

const base: Divergence = {
  kind: 'text',
  path: 'body > span',
  server: null,
  client: null,
};

const text = (server: string, client: string): Divergence => ({
  ...base,
  kind: 'text',
  server,
  client,
});

describe('classifier', () => {
  it('non-deterministic: differing UUIDs', () => {
    expect(
      classify(
        text(
          '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          '9a0c0305-e82c-3301-3f25-04e04f8941d3',
        ),
      ).category,
    ).toBe('non-deterministic-value');
  });

  it('non-deterministic: React useId values', () => {
    expect(classify(text(':r0:', ':R1:')).category).toBe(
      'non-deterministic-value',
    );
  });

  it('date-time: epoch timestamps a moment apart', () => {
    expect(classify(text('1700000000000', '1700000000500')).category).toBe(
      'date-time',
    );
  });

  // `Date.parse` accepts almost anything V8 can coerce: '100' is the year 100,
  // 'server-0' is the year 2000, 'item 5' is a date in May. Using it as a
  // *detector* diagnosed ordinary text and ordinary numbers as a clock drift —
  // "Price: 100 → 200" reported as "the clock moved" is worse than saying
  // nothing. A value must now look like a date by shape first.
  describe('date-time does not swallow ordinary values', () => {
    it.each([
      ['a price', '100', '200'],
      ['a stock count', '3', '7'],
      ['a four-digit quantity', '1400', '1500'],
      ['a percentage', '75', '90'],
      ['a hyphenated id', 'server-0', 'client-0'],
      ['a row key', 'row-3', 'row-4'],
      ['a labelled item', 'item 5', 'item 6'],
      ['a semver-ish build', 'build-2', 'build-3'],
    ])('leaves %s unclassified as a date', (_label, server, client) => {
      expect(classify(text(server, client)).category).not.toBe('date-time');
    });

    it.each([
      ['ISO dates', '2024-01-02', '2024-01-03'],
      ['slashed dates', '1/2/2024', '1/3/2024'],
      ['clock times', '10:30 AM', '11:45 AM'],
      ['month names', 'Jan 2, 2024', 'Jan 3, 2024'],
      ['epoch millis', '1700000000000', '1700000000500'],
    ])('still classifies %s as date-time', (_label, server, client) => {
      expect(classify(text(server, client)).category).toBe('date-time');
    });
  });

  it('locale-format: Arabic-Indic vs Latin digits (high confidence)', () => {
    const cause = classify(text('١٬٢٣٤', '1,234'));
    expect(cause.category).toBe('locale-format');
    expect(cause.confidence).toBeGreaterThan(0.9);
  });

  it('locale-format: separators swapped', () => {
    expect(classify(text('1,234.56', '1.234,56')).category).toBe(
      'locale-format',
    );
  });

  it('browser-only-api: empty server, content client', () => {
    expect(classify(text('', 'Signed in as Sam')).category).toBe(
      'browser-only-api',
    );
  });

  it('viewport-branching: structural swap', () => {
    expect(
      classify({ ...base, kind: 'structure', server: '<a/>', client: '<b/>' })
        .category,
    ).toBe('viewport-branching');
  });

  it('invalid-html-nesting wins over viewport for <div> in <p>', () => {
    expect(
      classify({
        ...base,
        kind: 'structure',
        parentTagName: 'P',
        tagName: 'DIV',
        server: null,
        client: '<div/>',
      }).category,
    ).toBe('invalid-html-nesting');
  });

  it('whitespace-minification: whitespace-only text delta', () => {
    expect(classify(text('Hello  world', 'Hello world')).category).toBe(
      'whitespace-minification',
    );
  });

  it('third-party-dom-mutation: known extension attribute', () => {
    expect(
      classify({
        ...base,
        kind: 'attribute',
        attribute: 'data-gramm',
        server: null,
        client: 'false',
      }).category,
    ).toBe('third-party-dom-mutation');
  });

  it('unknown: unmatched plain text delta', () => {
    expect(classify(text('Apples', 'Oranges')).category).toBe('unknown');
  });

  it('unknown: a structure divergence carrying no evidence', () => {
    // A bare "Hydration failed" message parses to this. Guessing
    // "viewport-branching" from it invents a cause out of nothing.
    expect(
      classify({ ...base, kind: 'structure', server: null, client: null })
        .category,
    ).toBe('unknown');
  });

  it('a client-only attribute is not blamed on a third party by default', () => {
    // Message-derived divergences all carry `body` as a placeholder path, so
    // the root-attribute heuristic must key off a resolved element instead.
    expect(
      classify({
        ...base,
        kind: 'attribute',
        path: 'body',
        attribute: 'data-total',
        server: null,
        client: '12',
      }).category,
    ).toBe('attribute-mismatch');
  });

  it('third-party-dom-mutation: unexpected attribute on <body> itself', () => {
    const body = document.createElement('body');
    expect(
      classify({
        ...base,
        kind: 'attribute',
        path: 'body',
        attribute: 'cz-shortcut-listen-like',
        server: null,
        client: 'true',
        element: body,
      }).category,
    ).toBe('third-party-dom-mutation');
  });

  it('custom classifiers run before built-ins', () => {
    const custom: Classifier = (d) =>
      d.client === 'Oranges'
        ? {
            category: 'unknown',
            confidence: 1,
            explanation: 'custom',
            suggestion: 'custom',
          }
        : null;
    const cause = classify(text('Apples', 'Oranges'), { extra: [custom] });
    expect(cause.explanation).toBe('custom');
  });

  it('a throwing custom classifier does not break the pipeline', () => {
    const boom: Classifier = () => {
      throw new Error('bad rule');
    };
    expect(
      classify(text('0.5488135039273248', '0.7151893663724195'), {
        extra: [boom],
      }).category,
    ).toBe('non-deterministic-value');
  });
});
