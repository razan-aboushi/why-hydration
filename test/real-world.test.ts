// Regression tests for false positives found running the package on a real
// production Next.js app (OpenSooq). Each mirrors an exact reported case.

import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/classify';
import {
  collectSnapshotAgainstDom,
  diffSnapshotAgainstDom,
} from '../src/core/diff';
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

  // Screenshot: react-toastify injects <section class="Toastify"> mid-tree; the
  // old index-based diff then compared <nav> against it and cascaded false
  // positives across every following sibling.
  describe('client-injected containers do not cascade (LCS alignment)', () => {
    it('skips an injected Toastify section and keeps siblings aligned', () => {
      const server = '<header>a</header><footer>b</footer>';
      const live =
        '<header>a</header>' +
        '<section class="Toastify" aria-live="polite">x</section>' +
        '<footer>b</footer>';
      expect(collectSnapshotAgainstDom(server, client(live))).toEqual([]);
    });

    it('finds a real mismatch even with an injection in between', () => {
      const server = '<header>a</header><footer>OLD</footer>';
      const live =
        '<header>a</header>' +
        '<div class="ReactModalPortal"></div>' +
        '<footer>NEW</footer>';
      const found = collectSnapshotAgainstDom(server, client(live));
      expect(found).toHaveLength(1);
      expect(found[0]!.kind).toBe('text');
      expect(found[0]!.server).toBe('OLD');
      expect(found[0]!.client).toBe('NEW');
    });
  });

  // Screenshot: <p>Loading…</p> (server Suspense fallback) vs client content.
  describe('pending Suspense fallbacks are not mismatches', () => {
    it('skips content inside a pending Suspense boundary', () => {
      const server = '<!--$?--><p>Loading…</p><!--/$-->';
      const live = '<div class="loaded">real content</div>';
      expect(collectSnapshotAgainstDom(server, client(live))).toEqual([]);
    });
  });

  // Issues 3 & 7: report ALL mismatches on the page, deterministically.
  describe('collects every mismatch on the page', () => {
    it('returns all divergences, not just the first', () => {
      const server = '<span>a</span><span>b</span><span>c</span>';
      const live = '<span>x</span><span>b</span><span>z</span>';
      const found = collectSnapshotAgainstDom(server, client(live));
      expect(found).toHaveLength(2);
      expect(found.map((d) => d.client).sort()).toEqual(['x', 'z']);
    });
  });
});
