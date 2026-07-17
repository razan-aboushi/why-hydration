/**
 * Trigger-mismatch playground. Each component deterministically produces one of
 * the cause categories when hydrated against server-rendered HTML. Toggle them
 * to see the overlay classify each one.
 */

import { useState } from 'react';

/** 1. non-deterministic-value — Math.random() in render. */
export function RandomId() {
  return <span>token: {Math.random().toString(36).slice(2)}</span>;
}

/** 2. date-time — new Date() in render. */
export function LiveClock() {
  return <time>{new Date().toLocaleTimeString()}</time>;
}

/** 3. locale-format — Arabic-Indic vs Latin digits. */
export function Price({ serverLocale = 'ar-EG' }: { serverLocale?: string }) {
  // On the server this would use `serverLocale`; on the client the browser
  // locale. Rendering the two differently is the mismatch.
  const locale = typeof window === 'undefined' ? serverLocale : 'en-US';
  return <span>{(1234.56).toLocaleString(locale)}</span>;
}

/** 4. viewport-branching — JS width check at first render. */
export function ResponsiveNav() {
  const isWide = typeof window !== 'undefined' && window.innerWidth > 768;
  return isWide ? <nav>Desktop menu</nav> : <aside>Mobile menu</aside>;
}

/** 5. browser-only-api — localStorage read during render. */
export function Theme() {
  const theme =
    typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
  return <span>{theme ?? ''}</span>;
}

export default function App() {
  const [tab, setTab] = useState<'random' | 'clock' | 'price' | 'nav' | 'theme'>(
    'random',
  );
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>why-hydration · trigger mismatch</h1>
      <p>Pick a scenario, reload, and watch the overlay classify the mismatch.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['random', 'clock', 'price', 'nav', 'theme'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <section style={{ marginTop: 16 }}>
        {tab === 'random' && <RandomId />}
        {tab === 'clock' && <LiveClock />}
        {tab === 'price' && <Price />}
        {tab === 'nav' && <ResponsiveNav />}
        {tab === 'theme' && <Theme />}
      </section>
    </main>
  );
}
