/**
 * Frozen English output of every built-in rule variant.
 *
 * `cause.explanation` and `cause.suggestion` reach users through the console
 * reporter and through `onReport`, where people log them, grep them and match
 * on them. The overlay renders localised text from `messageId` + `params`, but
 * the English strings themselves must never drift as a side effect of that.
 * This pins all of them, captured from the release before localisation.
 *
 * The one intended change is the valueless "hydration failed" report, which
 * used to say "Inspect the server vs client values above" when there were
 * none; it is asserted separately below.
 */

import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/classify';
import type { Divergence } from '../src/core/types';
import golden from './fixtures/classify-golden.json';

const body = document.createElement('body');

const CASES: Record<string, Divergence> = {
  'non-deterministic': {
    kind: 'text',
    path: 'p',
    server: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    client: '9a0c0305-e82c-3301-3f25-04e04f8941d3',
  },
  'date-time': {
    kind: 'text',
    path: 'p',
    server: '10:30 AM',
    client: '11:45 AM',
  },
  'locale-bidi': {
    kind: 'text',
    path: 'p',
    server: '٢٠٢٤/١/٢',
    client: '٢٠٢٤/١/٢\u200f',
  },
  'locale-script': { kind: 'text', path: 'p', server: '١٢٣٤', client: '1234' },
  'locale-separators': {
    kind: 'text',
    path: 'p',
    server: '1,234.56',
    client: '1.234,56',
  },
  'locale-date-order': {
    kind: 'text',
    path: 'p',
    server: '٢٠٢٤/٠١/٠٢',
    client: '٠٢/٠١/٢٠٢٤',
  },
  'browser-only': { kind: 'text', path: 'p', server: '', client: 'guest' },
  viewport: {
    kind: 'structure',
    path: 'p',
    tagName: 'ASIDE',
    parentTagName: 'DIV',
    server: '<section>d</section>',
    client: '<aside>m</aside>',
  },
  'nesting-shape': {
    kind: 'structure',
    path: 'p',
    tagName: 'DIV',
    parentTagName: 'P',
    server: null,
    client: '<div>x</div>',
  },
  'nesting-message': {
    kind: 'structure',
    path: 'body',
    server: null,
    client: null,
    reactMessage:
      'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
  },
  whitespace: {
    kind: 'text',
    path: 'p',
    server: 'alpha   beta',
    client: 'alpha beta',
  },
  'third-party-extension': {
    kind: 'attribute',
    path: 'p',
    attribute: 'data-gramm',
    server: null,
    client: 'false',
  },
  'third-party-root': {
    kind: 'attribute',
    path: 'body',
    attribute: 'data-foo',
    server: null,
    client: 'x',
    element: body,
  },
  'third-party-node': {
    kind: 'node-added',
    path: 'p',
    tagName: 'IFRAME',
    server: null,
    client: '<iframe src="about:blank"></iframe>',
  },
  'class-added': {
    kind: 'attribute',
    path: 'p',
    attribute: 'class',
    server: 'card',
    client: 'card wide',
  },
  'class-removed': {
    kind: 'attribute',
    path: 'p',
    attribute: 'class',
    server: 'card wide',
    client: 'card',
  },
  'class-both': {
    kind: 'attribute',
    path: 'p',
    attribute: 'class',
    server: 'a b',
    client: 'b c',
  },
  'class-neither': {
    kind: 'attribute',
    path: 'p',
    attribute: 'className',
    server: 'a b',
    client: 'b  a',
  },
  'class-arabic': {
    kind: 'attribute',
    path: 'p',
    attribute: 'class',
    server: 'بطاقة',
    client: 'بطاقة مخفي بارز',
  },
  style: {
    kind: 'attribute',
    path: 'p',
    attribute: 'style',
    server: 'color:red',
    client: 'color:blue',
  },
  'generic-attribute': {
    kind: 'attribute',
    path: 'p',
    attribute: 'id',
    server: 'a',
    client: 'b',
  },
  'generic-arabic-attribute': {
    kind: 'attribute',
    path: 'p',
    attribute: 'title',
    server: 'مرحبا بالعالم!',
    client: 'أهلا بالعالم!',
  },
  unknown: { kind: 'text', path: 'p', server: 'a', client: 'b' },
};

type Golden = Record<
  string,
  {
    category: string;
    confidence: number;
    explanation: string;
    suggestion: string;
    docsUrl?: string;
  }
>;

describe('built-in English output is unchanged', () => {
  it('covers every captured case', () => {
    const captured = Object.keys(golden as Golden).filter(
      (name) => name !== 'unknown-locationless',
    );
    expect(Object.keys(CASES).sort()).toEqual(captured.sort());
  });

  it.each(Object.keys(CASES))('%s', (name) => {
    const cause = classify(CASES[name]!);
    const expected = (golden as Golden)[name]!;
    expect({
      category: cause.category,
      confidence: cause.confidence,
      explanation: cause.explanation,
      suggestion: cause.suggestion,
      docsUrl: cause.docsUrl,
    }).toEqual(expected);
  });
});

describe('every built-in cause is addressable for localisation', () => {
  it.each(Object.keys(CASES))('%s carries a messageId', (name) => {
    expect(classify(CASES[name]!).messageId).toMatch(/^[a-z-]+(\.[a-z-]+)?$/);
  });
});

describe('a report with nothing to point at', () => {
  const locationless: Divergence = {
    kind: 'structure',
    path: 'body',
    server: null,
    client: null,
  };

  it('stays unknown', () => {
    expect(classify(locationless).category).toBe('unknown');
  });

  it('no longer asks the reader to inspect values that do not exist', () => {
    const before = (golden as Golden)['unknown-locationless']!;
    expect(before.explanation).toContain('values above');

    const cause = classify(locationless);
    expect(cause.explanation).not.toContain('values above');
    expect(cause.messageId).toBe('unknown.no-location');
    expect(cause.suggestion).toContain('HydrationSnapshotScript');
  });
});
