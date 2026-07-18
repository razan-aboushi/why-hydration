// Regression tests for false positives found running the package on a real
// production Next.js app (OpenSooq). Each mirrors an exact reported case.

import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/classify';
import { diffSnapshotAgainstDom } from '../src/core/diff';
import { isSameNumberDifferentSeparators } from '../src/core/classify/detectors';
import type { Divergence } from '../src/core/types';

function client(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('real-world false positives', () => {
  // Screenshot 2: a `class` diff was misreported as "Locale formatting".
  describe('className diff is NOT locale-format', () => {
    it('isSameNumberDifferentSeparators rejects class lists with digits', () => {
      expect(
        isSameNumberDifferentSeparators(
          'radius-8 border ripple p-8 noWrap pointer blueColor',
          'radius-8 border ripple p-8 noWrap pointer blueColor forceHide',
        ),
      ).toBe(false);
    });

    it('still matches genuine number-formatting differences', () => {
      expect(isSameNumberDifferentSeparators('1,234.56', '1.234,56')).toBe(true);
      expect(isSameNumberDifferentSeparators('1 234,56', '1,234.56')).toBe(true);
    });

    it('classifies a class toggle as attribute-mismatch with the token', () => {
      const d: Divergence = {
        kind: 'attribute',
        path: 'body > div > span:nth-child(13)',
        tagName: 'SPAN',
        attribute: 'class',
        server: 'radius-8 border ripple p-8 noWrap pointer blueColor',
        client: 'radius-8 border ripple p-8 noWrap pointer blueColor forceHide',
      };
      const cause = classify(d);
      expect(cause.category).toBe('attribute-mismatch');
      expect(cause.explanation).toContain('forceHide');
      expect(cause.explanation).toContain('class');
    });
  });

  // Screenshot 1: Google Funding Choices `googlefcInactive` hidden iframe.
  describe('third-party injected iframe', () => {
    const iframe =
      '<iframe name="googlefcInactive" src="about:blank" style="display: none; width: 0px; height: 0px; border: none; z-index: -1000; left: -1000px; top: -1000px;"></iframe>';

    it('is skipped by the diff (no false report)', () => {
      expect(
        diffSnapshotAgainstDom(
          '<main>content</main>',
          client(`<main>content</main>${iframe}`),
        ),
      ).toBeNull();
    });

    it('when reported, classifies as third-party-dom-mutation not browser-only', () => {
      const d: Divergence = {
        kind: 'node-added',
        path: 'body > iframe:nth-child(6)',
        tagName: 'IFRAME',
        parentTagName: 'BODY',
        server: null,
        client: iframe,
      };
      const cause = classify(d);
      expect(cause.category).toBe('third-party-dom-mutation');
    });
  });

  describe('content attributes still get value classification', () => {
    it('a title attribute with digit-script mismatch → locale-format', () => {
      const d: Divergence = {
        kind: 'attribute',
        path: 'body > span',
        tagName: 'SPAN',
        attribute: 'title',
        server: '١٢٣٤',
        client: '1234',
      };
      expect(classify(d).category).toBe('locale-format');
    });
  });

  describe('style attribute diff', () => {
    it('classifies as attribute-mismatch', () => {
      const d: Divergence = {
        kind: 'attribute',
        path: 'body > div',
        tagName: 'DIV',
        attribute: 'style',
        server: 'display:block',
        client: 'display:none',
      };
      expect(classify(d).category).toBe('attribute-mismatch');
    });
  });
});
