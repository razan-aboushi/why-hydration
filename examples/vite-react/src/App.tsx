/**
 * Trigger-mismatch playground. Each scenario deterministically produces one of
 * the cause categories when hydrated against the server-rendered HTML.
 *
 * The scenario lives in the URL (`?scenario=clock`), not in React state: the
 * server and the client must render the same scenario, and it has to survive
 * a reload — a mismatch only happens on the initial server render + hydrate.
 */

const onServer = typeof window === 'undefined';

/** 1. non-deterministic-value — Math.random() in render. */
export function RandomId() {
  return <span>token: {Math.random().toString(36).slice(2)}</span>;
}

/** 2. date-time — the clock moves between the server and client renders. */
export function LiveClock() {
  // The server "renders" a second earlier, so the difference is guaranteed
  // even when both happen within the same second.
  const now = new Date(Date.now() - (onServer ? 1000 : 0));
  return <time>{now.toLocaleTimeString('en-US')}</time>;
}

/** 3. locale-format — Arabic-Indic digits on the server, Latin on the client. */
export function Price() {
  const locale = onServer ? 'ar-EG' : 'en-US';
  return <span>{(1234.56).toLocaleString(locale)}</span>;
}

/** 4. viewport-branching — a JS width check at first render. */
export function ResponsiveNav() {
  // The server cannot know the width, so it always renders the mobile menu.
  const isWide = !onServer && window.innerWidth > 768;
  return isWide ? <nav>Desktop menu</nav> : <aside>Mobile menu</aside>;
}

/** 5. browser-only-api — localStorage read during render. */
export function Theme() {
  const theme = onServer ? '' : (localStorage.getItem('theme') ?? 'dark');
  return <span>{theme}</span>;
}

const SCENARIOS = {
  random: RandomId,
  clock: LiveClock,
  price: Price,
  nav: ResponsiveNav,
  theme: Theme,
} as const;

export type Scenario = keyof typeof SCENARIOS;

export function scenarioFrom(url: string): Scenario {
  const value = new URL(url, 'http://localhost').searchParams.get('scenario');
  return value && value in SCENARIOS ? (value as Scenario) : 'random';
}

export default function App({ scenario }: { scenario: Scenario }) {
  const Trigger = SCENARIOS[scenario];
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>why-hydration · trigger mismatch</h1>
      <p>
        Pick a scenario. Each link loads the page fresh, so the server renders
        it and the client hydrates it — and the overlay classifies the mismatch.
      </p>
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
          <a
            key={s}
            href={`?scenario=${s}`}
            style={{ fontWeight: s === scenario ? 700 : 400 }}
          >
            {s}
          </a>
        ))}
      </nav>
      <section style={{ marginTop: 16 }}>
        <Trigger />
      </section>
    </main>
  );
}
