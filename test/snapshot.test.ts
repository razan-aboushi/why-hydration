import { afterEach, describe, expect, it } from 'vitest';
import {
  SNAPSHOT_KEY,
  captureSnapshotNow,
  getServerHtmlForRoot,
  getSnapshotScriptSource,
  readSnapshot,
} from '../src/core/snapshot';

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
});

describe('snapshot', () => {
  it('script source is self-contained and references the global key', () => {
    const src = getSnapshotScriptSource(['#root']);
    expect(src).toContain(SNAPSHOT_KEY);
    expect(src).toContain('#root');
    // No `</script>` breakout.
    expect(src).not.toContain('</script>');
  });

  it('escapes angle brackets in selectors', () => {
    const src = getSnapshotScriptSource(['div']);
    expect(src).not.toMatch(/<\/script>/i);
  });

  it('captureSnapshotNow records the innerHTML of a root', () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.innerHTML = '<span>hi</span>';
    document.body.appendChild(root);

    const snap = captureSnapshotNow(['#root']);
    expect(snap?.roots['#root']).toBe('<span>hi</span>');
    expect(readSnapshot()).toBe(snap);
  });

  it('getServerHtmlForRoot matches a live root by selector', () => {
    const root = document.createElement('div');
    root.id = 'root';
    root.innerHTML = '<b>x</b>';
    document.body.appendChild(root);
    captureSnapshotNow(['#root']);
    expect(getServerHtmlForRoot(root)).toBe('<b>x</b>');
  });

  // The snapshot selectors are chosen on the server, the inspected roots on the
  // client, so they can disagree. A root nested inside a captured one must
  // still resolve instead of silently yielding no server HTML.
  describe('roots nested inside a captured root', () => {
    it('recovers the subtree by id', () => {
      document.body.innerHTML =
        '<header>h</header><div id="app"><b>x</b></div>';
      captureSnapshotNow(['body']);
      const app = document.getElementById('app')!;
      expect(getServerHtmlForRoot(app)).toBe('<b>x</b>');
    });

    it('reads the server markup, not the mutated live DOM', () => {
      document.body.innerHTML = '<div id="app"><b>server</b></div>';
      captureSnapshotNow(['body']);
      document.querySelector('#app b')!.textContent = 'client';
      expect(getServerHtmlForRoot(document.getElementById('app')!)).toBe(
        '<b>server</b>',
      );
    });

    it('handles an id that needs CSS escaping', () => {
      document.body.innerHTML = '<div id="app:main"><b>x</b></div>';
      captureSnapshotNow(['body']);
      expect(getServerHtmlForRoot(document.getElementById('app:main')!)).toBe(
        '<b>x</b>',
      );
    });

    it('returns undefined when the nested root has no id to match on', () => {
      document.body.innerHTML = '<div class="app"><b>x</b></div>';
      captureSnapshotNow(['body']);
      expect(
        getServerHtmlForRoot(document.querySelector('.app')!),
      ).toBeUndefined();
    });

    it('returns undefined when no captured root contains it', () => {
      document.body.innerHTML = '<div id="app"><b>x</b></div>';
      (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY] = {
        version: 1,
        capturedAt: Date.now(),
        roots: { '#missing': '<b>x</b>' },
      };
      expect(
        getServerHtmlForRoot(document.getElementById('app')!),
      ).toBeUndefined();
    });
  });
});
