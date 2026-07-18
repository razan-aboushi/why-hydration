'use client';

// Deterministic hydration mismatch: the server resolves the Arabic-Egypt locale
// (Arabic-Indic digits) while the client uses en-US (Latin digits). Same value,
// different digit script -> a real locale-format hydration mismatch.
export function LocaleMismatch() {
  const locale = typeof window === 'undefined' ? 'ar-EG' : 'en-US';
  return <strong>{(1234.56).toLocaleString(locale)}</strong>;
}
