/**
 * React 19's hydration messages, verbatim.
 *
 * React 19 puts a bulleted list of possible causes above its JSX diff tree:
 *
 *   - A server/client branch `if (typeof window !== 'undefined')`.
 *   - Variable input such as `Date.now()` or `Math.random()` …
 *
 * and writes a removed line at depth 0 as "- " + content — one space, exactly
 * like a bullet. Parsed as diff lines, the bullets became five bogus "server"
 * values, adding junk reports to every React 19 mismatch and pairing the real
 * client value with the first bullet. The messages below are copied from
 * react-dom 19's development build (and one captured from a live page), so
 * these tests break if the format ever moves under us again.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatConsoleArgs,
  parseAllHydrationDivergences,
  parseHydrationMessage,
} from '../src/core/react-message';
import { InspectorController } from '../src/react/controller';
import { resetCapture } from '../src/react/capture';
import { SNAPSHOT_KEY, type Snapshot } from '../src/core/snapshot';
import type { HydrationReport } from '../src/core/types';

const CAUSES =
  'This can happen if a SSR-ed Client Component used:\n\n' +
  "- A server/client branch `if (typeof window !== 'undefined')`.\n" +
  "- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.\n" +
  "- Date formatting in a user's locale which doesn't match the server.\n" +
  '- External changing data without sending a snapshot of it along with the HTML.\n' +
  '- Invalid HTML tag nesting.\n\n' +
  'It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.\n\n';

const LINK = 'https://react.dev/link/hydration-mismatch';

const BULLETS = [
  "A server/client branch `if (typeof window !== 'undefined')`.",
  'Invalid HTML tag nesting.',
  "Date formatting in a user's locale which doesn't match the server.",
];

/** Captured from a live React 19.3 page (onRecoverableError's error.message). */
const TEXT_MISMATCH_AR =
  "Hydration failed because the server rendered text didn't match the client. " +
  'As a result this tree will be regenerated on the client. ' +
  CAUSES +
  LINK +
  '\n\n' +
  '  <Provider>\n' +
  '    <BidiStress lang="ar">\n' +
  '      <main>\n' +
  '        <h1>\n' +
  '        <PriceSentence>\n' +
  '          <p data-case="bidi-price">\n' +
  '            <span>\n' +
  '+             السعر: ١٬٥٠٠ د.ك.\n' +
  '-             السعر: ١٬٤٠٠ د.ك.\n' +
  '        ...\n';

const TEXT_MISMATCH_EN = TEXT_MISMATCH_AR.replace(
  '+             السعر: ١٬٥٠٠ د.ك.\n-             السعر: ١٬٤٠٠ د.ك.',
  '+             Price: 1,500 KWD.\n-             Price: 1,400 KWD.',
);

/**
 * The attribute warning, assembled the way react-dom 19 does it:
 * console.error(template ending "%s%s", LINK, describeDiff(root)), where
 * describeDiff returns "\n\n" + the tree.
 */
const ATTRIBUTE_TEMPLATE =
  "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. " +
  "This won't be patched up. " +
  CAUSES +
  '%s%s';
const ATTRIBUTE_DIFF =
  '\n\n' +
  '  <App>\n' +
  '    <p\n' +
  '+     className="بطاقة card مخفي"\n' +
  '-     className="بطاقة card"\n' +
  '      title="x"\n' +
  '    >\n';

function attributeWarning(): string {
  return formatConsoleArgs([ATTRIBUTE_TEMPLATE, LINK, ATTRIBUTE_DIFF]);
}

afterEach(() => {
  resetCapture();
  delete (window as unknown as Record<string, unknown>)[SNAPSHOT_KEY];
  document.body.innerHTML = '';
  document.getElementById('why-hydration-overlay')?.remove();
  vi.restoreAllMocks();
});

describe('React 19 "hydration failed" (text)', () => {
  it.each([
    ['Arabic', TEXT_MISMATCH_AR, 'السعر: ١٬٤٠٠ د.ك.', 'السعر: ١٬٥٠٠ د.ك.'],
    ['English', TEXT_MISMATCH_EN, 'Price: 1,400 KWD.', 'Price: 1,500 KWD.'],
  ])(
    '%s: yields exactly the one real divergence',
    (_l, message, server, client) => {
      const found = parseAllHydrationDivergences(message);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ kind: 'text', server, client });
    },
  );

  it('never turns a cause bullet into a server value', () => {
    for (const message of [
      TEXT_MISMATCH_AR,
      TEXT_MISMATCH_EN,
      attributeWarning(),
    ]) {
      const values = parseAllHydrationDivergences(message).flatMap((d) => [
        d.server,
        d.client,
      ]);
      for (const bullet of BULLETS) expect(values).not.toContain(bullet);
    }
  });

  it('agrees with the single-divergence parser', () => {
    expect(parseHydrationMessage(TEXT_MISMATCH_AR)).toMatchObject({
      server: 'السعر: ١٬٤٠٠ د.ك.',
      client: 'السعر: ١٬٥٠٠ د.ك.',
    });
  });
});

describe('React 19 "attributes didn\'t match" (console.error with %s%s)', () => {
  it('formats to the link on its own line, then the tree', () => {
    const message = attributeWarning();
    const lines = message.split('\n');
    const link = lines.indexOf(LINK);
    expect(link).toBeGreaterThan(0);
    expect(lines[link + 1]).toBe('');
  });

  it('yields exactly the one attribute divergence', () => {
    const found = parseAllHydrationDivergences(attributeWarning());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: 'attribute',
      attribute: 'className',
      server: 'بطاقة card',
      client: 'بطاقة card مخفي',
    });
  });
});

describe('diff-line parsing around the link', () => {
  it('still reads a depth-0 diff line, which has a single space like a bullet', () => {
    const message = `Hydration failed.\n\n${LINK}\n\n+ client text\n- server text\n`;
    expect(parseAllHydrationDivergences(message)).toEqual([
      expect.objectContaining({ server: 'server text', client: 'client text' }),
    ]);
  });

  it('reads the whole message when there is no link (React 18.3 diff format)', () => {
    const message =
      "Warning: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.\n" +
      '  <App>\n' +
      '    <div\n' +
      '+     className="dark"\n' +
      '-     className="light"\n';
    expect(parseAllHydrationDivergences(message)).toEqual([
      expect.objectContaining({
        attribute: 'className',
        server: 'light',
        client: 'dark',
      }),
    ]);
  });

  it('keeps the legacy "Server: … Client: …" format unaffected', () => {
    expect(
      parseAllHydrationDivergences(
        'Warning: Text content did not match. Server: "١٢٣٤" Client: "1234"',
      ),
    ).toEqual([expect.objectContaining({ server: '١٢٣٤', client: '1234' })]);
  });
});

describe('end to end with React 19 messages', () => {
  function seed(serverHtml: string, clientHtml: string): void {
    const root = document.createElement('div');
    root.id = 'root';
    root.innerHTML = clientHtml;
    document.body.appendChild(root);
    (window as unknown as Record<string, Snapshot>)[SNAPSHOT_KEY] = {
      version: 1,
      capturedAt: Date.now(),
      roots: { '#root': serverHtml },
    };
  }

  it('reports the mismatch once, with no junk from the cause list', () => {
    seed(
      '<main><p><span>السعر: ١٬٤٠٠ د.ك.</span></p></main>',
      '<main><p><span>السعر: ١٬٥٠٠ د.ك.</span></p></main>',
    );
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // Handed over by hydrateRoot's onRecoverableError, as React 19 does.
    controller.onRecoverableError(new Error(TEXT_MISMATCH_AR));
    controller.inspectNow();

    // The DOM diff and the message describe the same values, so they
    // collapse into a single report.
    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0]).toMatchObject({
      server: 'السعر: ١٬٤٠٠ د.ك.',
      client: 'السعر: ١٬٥٠٠ د.ك.',
    });
    controller.stop();
  });

  it('reports a message-only attribute mismatch once', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const onReport = vi.fn<(r: HydrationReport) => void>();
    const controller = new InspectorController({ onReport, overlay: false });
    controller.start();
    // Logged through console.error, as React 19 does for attributes.
    // eslint-disable-next-line no-console
    console.error(ATTRIBUTE_TEMPLATE, LINK, ATTRIBUTE_DIFF);
    controller.inspectNow();

    expect(onReport).toHaveBeenCalledOnce();
    expect(onReport.mock.calls[0]![0].cause.category).toBe(
      'attribute-mismatch',
    );
    controller.stop();
  });
});
