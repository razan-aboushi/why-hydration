import { describe, expect, it } from 'vitest';
import { diffSnapshotAgainstDom } from '../src/core/diff';

function client(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('diff engine', () => {
  it('returns null for identical trees', () => {
    expect(
      diffSnapshotAgainstDom('<p>hi</p>', client('<p>hi</p>')),
    ).toBeNull();
  });

  it('detects a text divergence with a path', () => {
    const d = diffSnapshotAgainstDom('<p>a</p>', client('<p>b</p>'));
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('text');
    expect(d!.server).toBe('a');
    expect(d!.client).toBe('b');
    expect(d!.path).toContain('p');
  });

  it('detects an attribute divergence and names the attribute', () => {
    const d = diffSnapshotAgainstDom(
      '<a href="/a">x</a>',
      client('<a href="/b">x</a>'),
    );
    expect(d!.kind).toBe('attribute');
    expect(d!.attribute).toBe('href');
    expect(d!.server).toBe('/a');
    expect(d!.client).toBe('/b');
  });

  it('ignores cosmetic class/style ordering', () => {
    expect(
      diffSnapshotAgainstDom(
        '<div class="a b c"></div>',
        client('<div class="c a b"></div>'),
      ),
    ).toBeNull();
    expect(
      diffSnapshotAgainstDom(
        '<div style="color:red;margin:0"></div>',
        client('<div style="margin:0;color:red"></div>'),
      ),
    ).toBeNull();
  });

  it('detects a node added on the client', () => {
    const d = diffSnapshotAgainstDom('<ul></ul>', client('<ul><li>1</li></ul>'));
    expect(d!.kind).toBe('node-added');
    expect(d!.tagName).toBe('LI');
  });

  it('detects a node removed on the client', () => {
    const d = diffSnapshotAgainstDom('<ul><li>1</li></ul>', client('<ul></ul>'));
    expect(d!.kind).toBe('node-removed');
  });

  it('detects a structural tag swap', () => {
    const d = diffSnapshotAgainstDom('<b>x</b>', client('<i>x</i>'));
    expect(d!.kind).toBe('structure');
  });

  it('ignores formatting whitespace between elements', () => {
    expect(
      diffSnapshotAgainstDom(
        '<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>',
        client('<ul><li>a</li><li>b</li></ul>'),
      ),
    ).toBeNull();
  });
});
