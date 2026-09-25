/**
 * Invalid nesting, seen through the HTML parser.
 *
 * The server snapshot went through the parser, which repairs invalid nesting
 * while it parses: `<p><div/></p>` becomes `<p></p><div/><p></p>`. React
 * builds the client DOM node by node and nothing repairs it, so the same JSX
 * produces two differently shaped trees. Diffed as-is, one invalid `<div>`
 * surfaced as three wrong reports ("browser-only API", "viewport branching"
 * twice) plus React's own nesting warning — four cards for one mistake — and a
 * real text change inside it was never reported as one.
 *
 * The client side is now repaired the same way before comparing. These build
 * the live tree with DOM APIs, exactly as React does, so it keeps the invalid
 * shape the parser would never produce.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectSnapshotAgainstDom } from '../src/core/diff';
import { classify } from '../src/core/classify';
import { isInvalidNesting } from '../src/core/classify/detectors';
import { InspectorController } from '../src/react/controller';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { Divergence, HydrationReport } from '../src/core/types';

type Spec = [
  tag: string,
  children?: Array<Spec | string>,
  attrs?: Record<string, string>,
];

/** Build a live tree node by node, the way React does — nothing repairs it. */
function build(spec: Spec, into: Element): Element {
  const [tag, children = [], attrs = {}] = spec;
  const el = into.ownerDocument.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) {
    if (typeof c === 'string')
      el.appendChild(into.ownerDocument.createTextNode(c));
    else build(c, el);
  }
  into.appendChild(el);
  return el;
}

function live(...specs: Spec[]): Element {
  const root = document.createElement('div');
  for (const s of specs) build(s, root);
  return root;
}

const summary = (found: Divergence[]) =>
  found.map((d) => `${classify(d).category}:${d.kind}`);

afterEach(() => {
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
  vi.restoreAllMocks();
});

describe('a <div> inside a <p>', () => {
  const server =
    '<main><p><strong>Details: </strong><div>server</div></p></main>';

  it('is one report when nothing else differs', () => {
    const client = live([
      'main',
      [
        [
          'p',
          [
            ['strong', ['Details: ']],
            ['div', ['server']],
          ],
        ],
      ],
    ]);
    const found = collectSnapshotAgainstDom(server, client);
    expect(summary(found)).toEqual(['invalid-html-nesting:structure']);
  });

  it('still reports a real text change inside it, as a text change', () => {
    const client = live([
      'main',
      [
        [
          'p',
          [
            ['strong', ['Details: ']],
            ['div', ['client']],
          ],
        ],
      ],
    ]);
    const found = collectSnapshotAgainstDom(server, client);
    expect(summary(found)).toEqual([
      'invalid-html-nesting:structure',
      'unknown:text',
    ]);
    expect(found[1]).toMatchObject({ server: 'server', client: 'client' });
  });

  it('names the offending child and the parent it cannot be in', () => {
    const client = live(['main', [['p', [['div', ['x']]]]]]);
    const [nesting] = collectSnapshotAgainstDom(
      '<main><p><div>x</div></p></main>',
      client,
    );
    expect(nesting).toMatchObject({ tagName: 'DIV', parentTagName: 'P' });
  });

  it('points every report at the live node, not the repaired copy', () => {
    const client = live(['main', [['p', [['div', ['client']]]]]]);
    const liveDiv = client.querySelector('div')!;
    const found = collectSnapshotAgainstDom(
      '<main><p><div>server</div></p></main>',
      client,
    );
    for (const d of found) {
      expect(d.element, d.kind).toBe(liveDiv);
      expect(client.contains(d.element!)).toBe(true);
    }
  });

  it('is found through an intermediate element', () => {
    // A <div> anywhere inside a <p> closes it, not just a direct child.
    const client = live(['main', [['p', [['span', [['div', ['x']]]]]]]]);
    const found = collectSnapshotAgainstDom(
      '<main><p><span><div>x</div></span></p></main>',
      client,
    );
    expect(summary(found)).toEqual(['invalid-html-nesting:structure']);
  });

  it("keeps adjacent text nodes apart, as React's server HTML does", () => {
    // JSX `{label}: ` renders two text nodes; React's server HTML separates
    // them with <!-- -->. Merging them on the client side made every such
    // label look like a text change ("Details" → "Details: ").
    const client = document.createElement('div');
    const main = client.appendChild(document.createElement('main'));
    const p = main.appendChild(document.createElement('p'));
    const strong = p.appendChild(document.createElement('strong'));
    strong.append(
      document.createTextNode('Details'),
      document.createTextNode(': '),
    );
    p.appendChild(document.createElement('div')).textContent = 'x';

    const found = collectSnapshotAgainstDom(
      '<main><p><strong>Details<!-- -->: </strong><div>x</div></p></main>',
      client,
    );
    expect(summary(found)).toEqual(['invalid-html-nesting:structure']);
  });

  it('leaves text around the nested block alone', () => {
    const client = live([
      'main',
      [['p', ['before ', ['div', ['mid']], ' after']]],
    ]);
    const found = collectSnapshotAgainstDom(
      '<main><p>before <div>mid</div> after</p></main>',
      client,
    );
    expect(summary(found)).toEqual(['invalid-html-nesting:structure']);
  });
});

describe.each([
  [
    'nested <a>',
    '<nav><a href="/x">x<a href="/y">y</a></a></nav>',
    [
      'nav',
      [['a', ['x', ['a', ['y'], { href: '/y' }]], { href: '/x' }]],
    ] as Spec,
    'A',
    'A',
  ],
  [
    '<tr> directly in <table>',
    '<table><tr><td>1</td></tr></table>',
    ['table', [['tr', [['td', ['1']]]]]] as Spec,
    'TR',
    'TABLE',
  ],
  [
    '<div> in <tbody>',
    '<table><tbody><div>x</div><tr><td>1</td></tr></tbody></table>',
    [
      'table',
      [
        [
          'tbody',
          [
            ['div', ['x']],
            ['tr', [['td', ['1']]]],
          ],
        ],
      ],
    ] as Spec,
    'DIV',
    'TBODY',
  ],
  [
    'nested <form>',
    '<section><form><form><input></form></form></section>',
    ['section', [['form', [['form', [['input']]]]]]] as Spec,
    'FORM',
    'FORM',
  ],
])('%s', (_label, serverHtml, spec, child, parent) => {
  it('is one invalid-nesting report', () => {
    const found = collectSnapshotAgainstDom(serverHtml, live(spec));
    expect(summary(found)).toEqual(['invalid-html-nesting:structure']);
    expect(found[0]).toMatchObject({ tagName: child, parentTagName: parent });
  });
});

describe('valid markup is untouched', () => {
  it.each([
    [
      'inline content in a <p>',
      '<p>a <strong>b</strong> <em>c</em></p>',
      ['p', ['a ', ['strong', ['b']], ' ', ['em', ['c']]]] as Spec,
    ],
    [
      'a table with a <tbody>',
      '<table><tbody><tr><td>1</td></tr></tbody></table>',
      ['table', [['tbody', [['tr', [['td', ['1']]]]]]]] as Spec,
    ],
    [
      'a <button> inside a <form>',
      '<form><button>go</button></form>',
      ['form', [['button', ['go']]]] as Spec,
    ],
  ])('%s produces no report', (_label, serverHtml, spec) => {
    expect(collectSnapshotAgainstDom(serverHtml, live(spec))).toEqual([]);
  });

  it('still reports an ordinary mismatch exactly as before', () => {
    const found = collectSnapshotAgainstDom(
      '<p>server</p>',
      live(['p', ['client']]),
    );
    expect(summary(found)).toEqual(['unknown:text']);
  });
});

describe('the classifier agrees with the parser', () => {
  it.each([
    ['P', 'DIV'],
    ['P', 'UL'],
    ['P', 'TABLE'],
    ['P', 'H2'],
    ['P', 'FIGURE'],
    ['P', 'DETAILS'],
    ['P', 'LI'],
    ['A', 'A'],
    ['FORM', 'FORM'],
    ['BUTTON', 'BUTTON'],
    ['TABLE', 'TR'],
    ['TABLE', 'DIV'],
    ['TBODY', 'DIV'],
    ['TR', 'DIV'],
  ])('%s cannot contain %s', (parent, child) => {
    expect(isInvalidNesting(parent, child)).toBe(true);
  });

  it.each([
    ['P', 'SPAN'],
    ['P', 'STRONG'],
    ['A', 'SPAN'],
    ['TABLE', 'TBODY'],
    ['TABLE', 'CAPTION'],
    ['TBODY', 'TR'],
    ['TR', 'TD'],
    ['TR', 'TH'],
    ['DIV', 'P'],
  ])('%s may contain %s', (parent, child) => {
    expect(isInvalidNesting(parent, child)).toBe(false);
  });
});

describe('end to end', () => {
  function seed(serverHtml: string, spec: Spec): void {
    const root = document.createElement('div');
    root.id = 'root';
    build(spec, root);
    document.body.appendChild(root);
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#root': serverHtml },
    };
  }

  const cases: Array<[string, string]> = [
    [
      'React 18',
      'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
    ],
    [
      'React 19',
      'In HTML, <div> cannot be a descendant of <p>.\nThis will cause a hydration error.',
    ],
  ];

  it.each(cases)(
    "collapses the DOM report and %s's warning into one card",
    (_react, message) => {
      seed('<main><p><strong>D: </strong><div>same</div></p></main>', [
        'main',
        [
          [
            'p',
            [
              ['strong', ['D: ']],
              ['div', ['same']],
            ],
          ],
        ],
      ]);
      const onReport = vi.fn<(r: HydrationReport) => void>();
      const controller = new InspectorController({ onReport, overlay: false });
      controller.start();
      controller.onRecoverableError(new Error(message));
      controller.inspectNow();

      expect(onReport.mock.calls.map((c) => c[0].cause.category)).toEqual([
        'invalid-html-nesting',
      ]);
      controller.stop();
    },
  );

  it('lets `ignore` target the live nested element', () => {
    seed('<main><p><div class="legacy">x</div></p></main>', [
      'main',
      [['p', [['div', ['x'], { class: 'legacy' }]]]],
    ]);
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({
      onReport,
      overlay: false,
      ignore: ['.legacy'],
    });
    controller.start();
    controller.inspectNow();
    expect(onReport).not.toHaveBeenCalled();
    controller.stop();
  });
});
