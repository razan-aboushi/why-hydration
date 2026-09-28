/**
 * The paths the rest of the suite left uncovered, found with a coverage run
 * (`npm run test:coverage`). Each of these is reachable in a real app:
 *
 *  - component and source-file lookup from React's fibers — the "where" of
 *    every report — including memo, forwardRef and displayName components;
 *  - `<HydrationSnapshotScript>` and the snapshot script it emits, run for real;
 *  - the production no-op entry points;
 *  - long sibling lists, where the diff pairs by index instead of by key;
 *  - hidden third-party iframes, and the console reporter's full output.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveReactSource } from '../src/react/fiber';
import {
  createConsoleReporter,
  installConsoleInterceptor,
} from '../src/react/console';
import { resetCapture } from '../src/react/capture';
import { collectSnapshotAgainstDom, diffTrees } from '../src/core/diff';
import {
  SNAPSHOT_KEY,
  getServerHtmlForRoot,
  getSnapshotScriptSource,
  type Snapshot,
} from '../src/core/snapshot';
import { classify } from '../src/core/classify';
import type { HydrationReport } from '../src/core/types';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let reactRoot: Root | null = null;

async function renderLive(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await React.act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(node);
  });
  return container;
}

afterEach(async () => {
  if (reactRoot) {
    const r = reactRoot;
    reactRoot = null;
    await React.act(async () => r.unmount());
  }
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe('finding the component from React fibers', () => {
  function PriceTag() {
    return <span className="price">1</span>;
  }
  const Memoised = React.memo(function MemoPrice() {
    return <span className="memo">2</span>;
  });
  const Forwarded = React.forwardRef<HTMLSpanElement>(
    function RefPrice(_p, ref) {
      return (
        <span ref={ref} className="fwd">
          3
        </span>
      );
    },
  );
  function Anonymous() {
    return <b className="named">4</b>;
  }
  Anonymous.displayName = 'Named';

  it.each([
    ['a function component', <PriceTag key="a" />, '.price', 'PriceTag'],
    ['a memo component', <Memoised key="b" />, '.memo', 'MemoPrice'],
    ['a forwardRef component', <Forwarded key="c" />, '.fwd', 'RefPrice'],
    ['a component with displayName', <Anonymous key="d" />, '.named', 'Named'],
  ])('names %s', async (_label, element, selector, name) => {
    const container = await renderLive(<div>{element}</div>);
    expect(
      resolveReactSource(container.querySelector(selector)).component,
    ).toBe(name);
  });

  it('skips host elements to reach the nearest component', async () => {
    function Card() {
      return (
        <section>
          <p>
            <em className="deep">x</em>
          </p>
        </section>
      );
    }
    const container = await renderLive(<Card />);
    expect(resolveReactSource(container.querySelector('.deep')).component).toBe(
      'Card',
    );
  });

  it('reads the source file and line when the build records them', () => {
    const el = document.createElement('span');
    const component = {
      type: function Checkout() {},
      _debugSource: {
        fileName: '/app/src/Checkout.tsx',
        lineNumber: 42,
        columnNumber: 7,
      },
    };
    (el as unknown as Record<string, unknown>)['__reactFiber$test'] = {
      type: 'span',
      return: component,
    };
    expect(resolveReactSource(el)).toEqual({
      component: 'Checkout',
      location: { file: '/app/src/Checkout.tsx', line: 42, column: 7 },
    });
  });

  it('understands React 16/17 fiber keys too', () => {
    const el = document.createElement('span');
    (el as unknown as Record<string, unknown>)['__reactInternalInstance$old'] =
      {
        type: 'span',
        return: { type: function Legacy() {} },
      };
    expect(resolveReactSource(el).component).toBe('Legacy');
  });

  it('returns nothing, without throwing, for nodes React does not own', () => {
    expect(resolveReactSource(null)).toEqual({});
    expect(resolveReactSource(document.createElement('div'))).toEqual({});
    const hostile = document.createElement('div');
    Object.defineProperty(hostile, '__reactFiber$x', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(resolveReactSource(hostile)).toEqual({});
  });

  it('stops at a bounded depth on a cyclic fiber chain', () => {
    const el = document.createElement('span');
    const fiber: Record<string, unknown> = { type: 'span' };
    fiber.return = fiber;
    (el as unknown as Record<string, unknown>)['__reactFiber$cycle'] = fiber;
    expect(resolveReactSource(el)).toEqual({});
  });
});

// ---------------------------------------------------------------------------

describe('<HydrationSnapshotScript> and the script it emits', () => {
  async function load() {
    return (await import('../src/next/script')).HydrationSnapshotScript;
  }

  it('renders an inline script with the snapshot source and a nonce', async () => {
    const Script = await load();
    const html = renderToStaticMarkup(<Script nonce="abc123" />);
    expect(html.startsWith('<script nonce="abc123">')).toBe(true);
    expect(html).toContain(SNAPSHOT_KEY);
  });

  it('renders nothing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const Script = await load();
    expect(renderToStaticMarkup(<Script />)).toBe('');
  });

  it('cannot be broken out of by a selector containing </script>', () => {
    const src = getSnapshotScriptSource(['#a</script><script>alert(1)//']);
    expect(src).not.toContain('</script>');
    expect(src).toContain('\\u003c/script>');
  });

  function runScript(source: string): void {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(source)();
  }

  it('captures each root as the server rendered it', () => {
    document.body.innerHTML =
      '<div id="root"><span>server</span></div><div id="other">x</div>';
    runScript(getSnapshotScriptSource(['#root', '#missing', '#other']));
    const snap = (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY]!;
    expect(snap.version).toBe(1);
    expect(snap.roots).toEqual({
      '#root': '<span>server</span>',
      '#other': 'x',
    });
  });

  it('captures once: a second run keeps the first snapshot', () => {
    document.body.innerHTML = '<div id="root">first</div>';
    runScript(getSnapshotScriptSource(['#root']));
    document.getElementById('root')!.textContent = 'hydrated';
    runScript(getSnapshotScriptSource(['#root']));
    expect(
      (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY]!.roots[
        '#root'
      ],
    ).toBe('first');
  });

  it('waits for the document when it runs while the page is still loading', () => {
    document.body.innerHTML = '<div id="root">parsed later</div>';
    const state = vi
      .spyOn(document, 'readyState', 'get')
      .mockReturnValue('loading');
    runScript(getSnapshotScriptSource(['#root']));
    expect(
      (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY],
    ).toBeUndefined();

    state.mockReturnValue('interactive');
    document.dispatchEvent(new Event('readystatechange'));
    expect(
      (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY]!.roots[
        '#root'
      ],
    ).toBe('parsed later');
  });

  it('resolves a root nested inside a captured one by an escaped id', () => {
    document.body.innerHTML =
      '<main><div id="a:b.c"><i>server</i></div></main>';
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: 0,
      roots: { main: '<div id="a:b.c"><i>server</i></div>', '>>>bad': 'x' },
    };
    expect(getServerHtmlForRoot(document.getElementById('a:b.c')!)).toBe(
      '<i>server</i>',
    );
  });
});

// ---------------------------------------------------------------------------

describe('in production', () => {
  it('<HydrationInspector> renders its children and nothing else', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { HydrationInspector } = await import('../src/react/index');
    const original = console.error;
    const container = await renderLive(
      <HydrationInspector>
        <span id="child">app</span>
      </HydrationInspector>,
    );
    expect(container.querySelector('#child')!.textContent).toBe('app');
    expect(document.getElementById('why-hydration-overlay')).toBeNull();
    expect(console.error).toBe(original);
  });

  it('createHydrationInspector() returns inert functions', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { createHydrationInspector } = await import('../src/react/index');
    const original = console.error;
    const handle = createHydrationInspector({ onReport: () => {} });
    expect(console.error).toBe(original);
    expect(() => handle.onRecoverableError(new Error('x'))).not.toThrow();
    expect(() => handle.update({ overlay: false })).not.toThrow();
    const container = await renderLive(
      <handle.Provider>
        <b id="kid">k</b>
      </handle.Provider>,
    );
    expect(container.querySelector('#kid')).not.toBeNull();
  });

  it('the Next.js entry re-exports the same components', async () => {
    const next = await import('../src/next/index');
    const react = await import('../src/react/index');
    expect(next.HydrationInspector).toBe(react.HydrationInspector);
    expect(next.createHydrationInspector).toBe(react.createHydrationInspector);
  });
});

// ---------------------------------------------------------------------------

describe('long sibling lists', () => {
  // Over 200 children the diff pairs siblings by index instead of running the
  // quadratic alignment, so these branches only run on big lists.
  const items = (n: number, at: number, swap: string) =>
    Array.from({ length: n }, (_, i) =>
      i === at ? swap : `<li>${i}</li>`,
    ).join('');

  function client(html: string): Element {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  }

  it('reports an element swapped for another tag', () => {
    const found = collectSnapshotAgainstDom(
      `<ul>${items(250, 120, '<li>120</li>')}</ul>`,
      client(`<ul>${items(250, 120, '<p>120</p>')}</ul>`),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'structure', tagName: 'P' });
  });

  it('reports an element swapped for text', () => {
    const found = collectSnapshotAgainstDom(
      `<div>${items(250, 10, '<li>10</li>')}</div>`,
      client(`<div>${items(250, 10, 'plain text')}</div>`),
    );
    expect(found.map((d) => d.kind)).toContain('structure');
    expect(found.find((d) => d.kind === 'structure')!.server).toBe(
      '<li>10</li>',
    );
  });

  it('stays quiet when a long list is identical', () => {
    const html = `<ul>${items(300, -1, '')}</ul>`;
    expect(collectSnapshotAgainstDom(html, client(html))).toEqual([]);
  });

  it('diffTrees returns just the first divergence', () => {
    const server = client('<span>a</span><span>b</span>');
    const live = client('<span>x</span><span>y</span>');
    expect(diffTrees(server, live)).toMatchObject({ server: 'a', client: 'x' });
    expect(diffTrees(server, server.cloneNode(true) as Element)).toBeNull();
  });
});

describe('third-party iframes the client added', () => {
  it.each([
    [
      'display:none',
      '<iframe src="https://x.test" style="display:none"></iframe>',
    ],
    [
      'visibility:hidden',
      '<iframe src="https://x.test" style="visibility: hidden"></iframe>',
    ],
    [
      'off-screen',
      '<iframe src="https://x.test" style="position:absolute;left:-9999px"></iframe>',
    ],
    [
      'zero-sized',
      '<iframe src="https://x.test" style="width:0;height:0"></iframe>',
    ],
    ['the hidden attribute', '<iframe src="https://x.test" hidden></iframe>'],
    [
      'aria-hidden',
      '<iframe src="https://x.test" aria-hidden="true"></iframe>',
    ],
    ['about:blank', '<iframe src="about:blank"></iframe>'],
  ])('ignores one hidden via %s', (_label, iframe) => {
    const live = document.createElement('div');
    live.innerHTML = `<p>app</p>${iframe}`;
    expect(collectSnapshotAgainstDom('<p>app</p>', live)).toEqual([]);
  });

  it('still reports a visible iframe the app itself added', () => {
    const live = document.createElement('div');
    live.innerHTML =
      '<p>app</p><iframe src="https://maps.test/embed"></iframe>';
    const [d] = collectSnapshotAgainstDom('<p>app</p>', live);
    expect(d?.kind).toBe('node-added');
    expect(classify(d!).category).toBe('third-party-dom-mutation');
  });
});

// ---------------------------------------------------------------------------

describe('the console', () => {
  it('prints every part of a report, including source and stack', () => {
    const logs: unknown[][] = [];
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a));
    const report: HydrationReport = {
      id: 'r',
      timestamp: 0,
      component: 'PriceTag',
      componentStack: '\n    at PriceTag',
      location: { file: '/src/PriceTag.tsx', line: 9 },
      node: { path: 'p', kind: 'text' },
      server: 'a',
      client: 'b',
      cause: {
        category: 'unknown',
        confidence: 0,
        explanation: 'E',
        suggestion: 'S',
        docsUrl: 'https://d.test',
      },
    };
    createConsoleReporter()(report);
    createConsoleReporter()({
      ...report,
      location: { file: '/src/NoLine.tsx' },
    });
    const values = logs.map((l) => String(l.at(-1)));
    expect(values).toContain('/src/PriceTag.tsx:9');
    expect(values).toContain('/src/NoLine.tsx');
    expect(values).toContain('<PriceTag>');
    expect(values).toContain('https://d.test');
    expect(values).toContain('\n    at PriceTag');
  });

  it('never lets a failing listener break console.error', () => {
    const seen: unknown[][] = [];
    const base = vi
      .spyOn(console, 'error')
      .mockImplementation((...a) => void seen.push(a));
    const restore = installConsoleInterceptor(() => {
      throw new Error('listener failed');
    });
    expect(() =>
      console.error(
        'Warning: Text content did not match. Server: "a" Client: "b"',
      ),
    ).not.toThrow();
    expect(seen).toHaveLength(1);
    restore();
    base.mockRestore();
  });

  it('logs a non-hydration error normally and ignores it', () => {
    const onMessage = vi.fn();
    const base = vi.spyOn(console, 'error').mockImplementation(() => {});
    const restore = installConsoleInterceptor(onMessage);
    console.error('TypeError: x is undefined');
    console.error();
    expect(onMessage).not.toHaveBeenCalled();
    expect(base).toHaveBeenCalledTimes(2);
    restore();
    base.mockRestore();
  });
});

// ---------------------------------------------------------------------------

describe('the public entry points', () => {
  it('exports everything the README documents', async () => {
    const core = await import('../src/index');
    for (const name of [
      'classify',
      'BUILT_IN_RULES',
      'CONFIDENCE_THRESHOLD',
      'UNKNOWN_CAUSE',
      'UNKNOWN_NO_LOCATION_CAUSE',
      'isLocationless',
      'ReportCollector',
      'buildReport',
      'signatureOf',
      'inspectRoot',
      'reportFromMessage',
      'diffSnapshotAgainstDom',
      'diffTrees',
      'parseServerHtml',
      'getSnapshotScriptSource',
      'captureSnapshotNow',
      'readSnapshot',
      'getServerHtmlForRoot',
      'SNAPSHOT_KEY',
      'DEFAULT_SNAPSHOT_SELECTORS',
      'formatConsoleArgs',
      'isHydrationMessage',
      'parseHydrationMessage',
      'isDev',
    ]) {
      expect(core, name).toHaveProperty(name);
    }
  });
});

describe('the dev check without a `process` global', () => {
  // Vite, Rollup and esbuild substitute process.env.NODE_ENV but never define
  // `process` itself. Run the real module where `process` does not exist.
  async function isDevWhere(processValue: unknown): Promise<boolean> {
    const ts = (await import('typescript')).default;
    const { readFileSync } = await import('node:fs');
    const { runInNewContext } = await import('node:vm');
    const code = ts.transpileModule(
      readFileSync(`${process.cwd()}/src/core/env.ts`, 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText;
    const sandbox: Record<string, unknown> = { module: { exports: {} } };
    sandbox.exports = (sandbox.module as { exports: object }).exports;
    if (processValue !== undefined) sandbox.process = processValue;
    runInNewContext(code, sandbox);
    return (sandbox.module as { exports: { isDev: boolean } }).exports.isDev;
  }

  it('is dev when `process` is not defined at all', async () => {
    expect(await isDevWhere(undefined)).toBe(true);
  });
  it('is dev when NODE_ENV is development', async () => {
    expect(await isDevWhere({ env: { NODE_ENV: 'development' } })).toBe(true);
  });
  it('is off when NODE_ENV is production', async () => {
    expect(await isDevWhere({ env: { NODE_ENV: 'production' } })).toBe(false);
  });
});
