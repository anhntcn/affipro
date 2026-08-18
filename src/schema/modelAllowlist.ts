// Gemini model id pin + CI allowlist (single source of truth).
//
// MODEL_ID is imported by the server handler AND asserted by the CI allowlist
// check, so the deployed model id can only ever be one of the ids below — an
// unknown or typo'd id fails the static CI check instead of 404-ing at runtime.
//
// VERIFICATION: this list was built from a LIVE `ai.models.list()` call + real
// `generateContent` probes against the project's Gemini key on 2026-08-18
// (not guessed). `gemini-3.6-flash` and `gemini-flash-latest` were confirmed to
// return finishReason=STOP. RE-VERIFY against the live API before extending —
// "listed by models.list()" does NOT guarantee usable (see history below).
//
// History / lesson learned:
//   - `gemini-2.5-flash` was the original pin but now returns HTTP 404
//     "no longer available to new users" — Google's own error recommends
//     `gemini-3.6-flash`. It is still returned by models.list() yet is NOT
//     callable, so it was removed from the pin and the allowlist.
//   - The Gemini 3.x flash family (3.5 / 3.6 / …) is REAL (released after some
//     tooling's knowledge cutoff); an earlier "cleanup" wrongly deleted
//     `gemini-3.6-flash` as fabricated. Corrected here against the live API.
//   - `gemini-3.7-flash` is intentionally EXCLUDED: CLAUDE.md flags it invalid.

/** The pinned model the server calls (Google-recommended replacement for 2.5-flash). Must be a member of ALLOWLIST. */
export const MODEL_ID = 'gemini-3.6-flash';

/** Live-verified callable flash model ids (2026-08-18). Excludes deprecated 2.5-flash and CLAUDE.md-flagged 3.7-flash. */
export const ALLOWLIST = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
] as const;

// Invariant: the pinned id is always a member of the allowlist.
if (!ALLOWLIST.includes(MODEL_ID)) {
  throw new Error(`MODEL_ID "${MODEL_ID}" is not in the verified ALLOWLIST`);
}
