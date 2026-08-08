---
'why-hydration': patch
---

Fix the inspector lifecycle, bound detection cost, and close detection gaps.

**Lifecycle**

- `createHydrationInspector()` is no longer dead after a React Strict Mode
  remount. Its `<Provider>` only ever stopped the controller, so Strict Mode's
  setup → cleanup → setup left the documented Vite/CRA/Remix integration
  silently doing nothing for the rest of the session.
- The dev check no longer requires a `process` global. Vite, Rollup and esbuild
  substitute `process.env.NODE_ENV` without defining `process` itself, which
  compiled the old `typeof process !== 'undefined'` guard down to `false` and
  disabled the inspector entirely in those bundlers.
- Scheduling races an animation frame against a timer, so a page that is hidden
  at load — where the browser suspends `requestAnimationFrame` outright — is
  still inspected.
- The console capture hands `console.error` back correctly when the same
  listener subscribes twice, and its message cap now drops past-cap messages
  instead of recording-but-forwarding them (which broke dedup exactly when the
  cap was meant to engage).

**Cost**

- A burst of React warnings arriving in one frame triggers one diff pass rather
  than one per warning.
- Captured server markup is parsed once per root and reused across the settling
  window instead of being re-parsed on every pass.
- Retained warning text is bounded, so an app erroring in a render loop cannot
  grow the per-pass cost without limit.

**Detection**

- `date-time` no longer fires on ordinary values. `Date.parse` accepts almost
  anything — `100` is the year 100, `server-0` is the year 2000 — so prices,
  counts and ids were being diagnosed as a clock or timezone drift. A value must
  now look like a date by shape.
- Arabic formatting mismatches are detected when both sides use the same digit
  script: grouping/decimal separators, field order and times in Arabic-Indic and
  Persian digits previously fell through to `unknown`.
- Values differing only by invisible bidirectional control marks (LRM/RLM/ALM,
  isolates) are detected and named. Different ICU versions emit different marks
  for the same `Intl` call, so Node and the browser routinely produce strings
  that look identical and are not.
- Report values are no longer truncated mid surrogate pair.

**Overlay**

- A panel re-mounted after being dismissed no longer reports a stale count or
  promise scrolling it cannot do.

Note for anyone consuming `report.cause.category` in an `onReport` sink: the
`date-time` and `locale-format` fixes change which category some mismatches
resolve to.
