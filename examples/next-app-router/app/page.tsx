import { LocaleMismatch } from './triggers';

export default function Page() {
  return (
    <main style={{ padding: 40, color: '#0f172a' }}>
      <h1>why-hydration · Next.js smoke test</h1>
      <p>
        Price with a locale mismatch: <LocaleMismatch />
      </p>
      <p style={{ color: '#64748b' }}>
        The server renders Arabic-Indic digits, the client renders Latin — the
        overlay should appear bottom-right classifying it as locale-format.
      </p>
    </main>
  );
}
