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
});
