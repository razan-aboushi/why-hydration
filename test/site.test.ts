/**
 * The GitHub Pages site (`docs/`).
 *
 * It exists to be found, so what search engines and link previews read has to
 * be present and correct, and it must never drift from the README: the error
 * messages it quotes are the same list, checked against each other here.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isHydrationMessage,
  parseAllHydrationDivergences,
} from '../src/core/react-message';

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const SITE = 'https://razan-aboushi.github.io/why-hydration/';

const page = new DOMParser().parseFromString(
  read('docs/index.html'),
  'text/html',
);
const meta = (sel: string) =>
  page.querySelector(sel)?.getAttribute('content') ?? '';

function readmeMessages(): string[] {
  const readme = read('README.md');
  const start = readme.indexOf('### Searching for this error?');
  const section = readme.slice(start, readme.indexOf('\n---', start));
  return [...section.matchAll(/```text\n([\s\S]*?)```/g)]
    .flatMap((m) => m[1]!.split('\n'))
    .map((l) => l.trim())
    .filter(Boolean);
}

const siteMessages = [...page.querySelectorAll('.errors pre')]
  .flatMap((pre) => pre.textContent!.split('\n'))
  .map((l) => l.trim())
  .filter(Boolean);

describe('what search engines read', () => {
  it('has a descriptive title and description of sensible length', () => {
    expect(page.title).toMatch(/why-hydration/);
    expect(page.title).toMatch(/React/);
    const description = meta('meta[name="description"]');
    expect(description.length).toBeGreaterThan(80);
    expect(description.length).toBeLessThanOrEqual(300);
  });

  it('is indexable and names its canonical URL', () => {
    expect(meta('meta[name="robots"]')).toBe('index, follow');
    expect(
      page.querySelector('link[rel="canonical"]')!.getAttribute('href'),
    ).toBe(SITE);
    expect(page.documentElement.lang).toBe('en');
  });

  it('has valid structured data', () => {
    const ld = JSON.parse(
      page.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(ld['@type']).toBe('SoftwareSourceCode');
    expect(ld.codeRepository).toBe(
      'https://github.com/razan-aboushi/why-hydration',
    );
    expect(ld.url).toBe(SITE);
  });

  it('has link-preview tags whose image exists', () => {
    for (const sel of [
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:url"]',
    ]) {
      expect(meta(sel), sel).not.toBe('');
    }
    const image = meta('meta[property="og:image"]');
    expect(image.startsWith(SITE)).toBe(true);
    expect(existsSync(join(root, 'docs', image.slice(SITE.length)))).toBe(true);
    expect(meta('meta[name="twitter:image"]')).toBe(image);
  });

  it('has a robots.txt and a sitemap that point at the site', () => {
    expect(read('docs/robots.txt')).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(read('docs/sitemap.xml')).toContain(`<loc>${SITE}</loc>`);
    // Serve files as-is: no Jekyll processing on GitHub Pages.
    expect(existsSync(join(root, 'docs/.nojekyll'))).toBe(true);
  });
});

describe('what visitors see', () => {
  it('references only images that exist, with dimensions and alt text', () => {
    for (const img of page.querySelectorAll('img')) {
      const src = img.getAttribute('src')!;
      expect(existsSync(join(root, 'docs', src)), src).toBe(true);
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
    }
  });

  it("quotes exactly the README's error messages", () => {
    expect(siteMessages).toEqual(readmeMessages());
  });

  it.each(siteMessages)('recognizes: %s', (message) => {
    expect(isHydrationMessage(message)).toBe(true);
    expect(parseAllHydrationDivergences(message).length).toBeGreaterThan(0);
  });

  it('shows the same Next.js setup as the README', () => {
    const readme = read('README.md');
    const snippet = page.querySelectorAll('pre code')[1]!.textContent!;
    for (const line of snippet
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)) {
      expect(readme, line).toContain(line);
    }
  });

  it('marks the Arabic sample as Arabic, right-to-left', () => {
    const sample = page.querySelector('.rtl')!;
    expect(sample.getAttribute('dir')).toBe('rtl');
    expect(sample.getAttribute('lang')).toBe('ar');
  });
});
