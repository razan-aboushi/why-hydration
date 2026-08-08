/**
 * Overlay behaviour: dismissal, the scroll hint, and what the panel claims
 * about itself.
 *
 * The panel is a *view* over the collector, not a second copy of it. Its
 * header count and its "scroll to see all" hint describe the cards currently in
 * the list — so they have to be torn down with the list. `push()` re-mounts an
 * empty panel on demand (a mismatch arriving after the user dismissed it is
 * still worth surfacing), and a counter that survived the teardown made the
 * re-mounted panel lie: "14 issues — scroll to see all" above a single card
 * that does not scroll.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createOverlay } from '../src/react/overlay';
import type { HydrationReport } from '../src/core/types';

let n = 0;
function report(overrides: Partial<HydrationReport> = {}): HydrationReport {
  n += 1;
  return {
    id: `r${n}`,
    timestamp: 0,
    node: { path: `body > span:nth-child(${n})`, kind: 'text' },
    server: `server-${n}`,
    client: `client-${n}`,
    cause: {
      category: 'unknown',
      confidence: 0,
      explanation: 'e',
      suggestion: 's',
    },
    ...overrides,
  };
}

const shadow = (): ShadowRoot =>
  document.getElementById('why-hydration-overlay')!.shadowRoot!;

const q = (sel: string): Element | null => shadow().querySelector(sel);

const state = () => ({
  count: q('.wh-count')!.textContent,
  cards: shadow().querySelectorAll('.wh-card').length,
  hintShown: q('.wh-hint')!.classList.contains('wh-show'),
  hintText: q('.wh-hint-text')!.textContent,
});

afterEach(() => {
  document.getElementById('why-hydration-overlay')?.remove();
  document.body.innerHTML = '';
});

describe('the panel does not overstate what it is showing', () => {
  it('reports a count that matches the cards in the list', () => {
    const overlay = createOverlay();
    for (let i = 0; i < 5; i++) overlay.push(report());
    const s = state();

    expect(s.cards).toBe(5);
    expect(s.count).toBe('5');
    overlay.destroy();
  });

  it('starts clean when a report re-mounts a dismissed panel', () => {
    const overlay = createOverlay();
    for (let i = 0; i < 14; i++) overlay.push(report());
    expect(state().count).toBe('14');

    // The user dismisses it; a late mismatch then arrives.
    overlay.destroy();
    expect(document.getElementById('why-hydration-overlay')).toBeNull();
    overlay.push(report());

    const s = state();
    expect(s.cards).toBe(1);
    // Not "14" — the previous cards went with the panel.
    expect(s.count).toBe('1');
    overlay.destroy();
  });

  it('does not promise scrolling to a panel with one card', async () => {
    const overlay = createOverlay();
    for (let i = 0; i < 14; i++) overlay.push(report());
    overlay.destroy();
    overlay.push(report());

    // The hint is debounced; let it settle.
    await new Promise((r) => setTimeout(r, 500));
    const s = state();
    expect(s.hintShown).toBe(false);
    expect(s.hintText).not.toContain('14');
    overlay.destroy();
  });

  it('shows the hint again once a re-mounted panel really does overflow', async () => {
    const overlay = createOverlay();
    overlay.push(report());
    overlay.destroy();
    for (let i = 0; i < 6; i++) overlay.push(report());

    await new Promise((r) => setTimeout(r, 500));
    const s = state();
    expect(s.cards).toBe(6);
    expect(s.hintShown).toBe(true);
    expect(s.hintText).toContain('6');
    overlay.destroy();
  });
});

describe('dismissal', () => {
  it('removes the panel when the Dismiss button is clicked', () => {
    const overlay = createOverlay();
    overlay.push(report());
    const button = [...shadow().querySelectorAll('.wh-btn')].find(
      (b) => b.textContent === 'Dismiss',
    ) as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe(
      'Dismiss diagnostics overlay',
    );
    button.click();
    expect(document.getElementById('why-hydration-overlay')).toBeNull();
  });

  it('removes the panel on Escape', () => {
    const overlay = createOverlay();
    overlay.push(report());
    const host = document.getElementById('why-hydration-overlay')!;

    host.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(document.getElementById('why-hydration-overlay')).toBeNull();
    overlay.destroy();
  });

  it('closes only the hint when the hint ✕ is clicked', async () => {
    const overlay = createOverlay();
    for (let i = 0; i < 5; i++) overlay.push(report());
    await new Promise((r) => setTimeout(r, 500));
    expect(state().hintShown).toBe(true);

    (q('.wh-hint-x') as HTMLButtonElement).click();

    expect(state().hintShown).toBe(false);
    // The panel itself must survive — the ✕ closes the hint, not the overlay.
    expect(document.getElementById('why-hydration-overlay')).not.toBeNull();
    expect(state().cards).toBe(5);
    overlay.destroy();
  });

  it('replaces a stale panel rather than stacking a second one', () => {
    const first = createOverlay();
    first.push(report());
    const second = createOverlay();
    second.push(report());

    expect(document.querySelectorAll('#why-hydration-overlay')).toHaveLength(1);
    first.destroy();
    second.destroy();
  });
});

describe('report values are rendered as text', () => {
  it('never interprets a mismatched value as markup', () => {
    const overlay = createOverlay();
    overlay.push(
      report({ server: '<img src=x onerror="boom()">', client: 'safe' }),
    );

    expect(shadow().querySelector('img')).toBeNull();
    expect(shadow().querySelector('script')).toBeNull();
    expect(q('.wh-server')!.textContent).toContain(
      '<img src=x onerror="boom()">',
    );
    overlay.destroy();
  });

  it('only links out to http(s) docs URLs', () => {
    const overlay = createOverlay();
    overlay.push(
      report({
        cause: {
          category: 'unknown',
          confidence: 0,
          explanation: 'e',
          suggestion: 's',
          docsUrl: 'javascript:alert(1)',
        },
      }),
    );

    expect(shadow().querySelector('.wh-docs')).toBeNull();
    overlay.destroy();
  });

  it('renders a real docs link with safe rel/target', () => {
    const overlay = createOverlay();
    overlay.push(
      report({
        cause: {
          category: 'unknown',
          confidence: 0,
          explanation: 'e',
          suggestion: 's',
          docsUrl: 'https://example.com/docs',
        },
      }),
    );

    const link = q('.wh-docs') as HTMLAnchorElement;
    expect(link.href).toBe('https://example.com/docs');
    expect(link.rel).toBe('noreferrer noopener');
    expect(link.target).toBe('_blank');
    overlay.destroy();
  });
});
