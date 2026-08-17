// Gemini model id pin + CI allowlist (single source of truth).
//
// MODEL_ID is imported by the server handler AND asserted by the CI allowlist
// check, so the deployed model id can only ever be one of the ids below — an
// unknown or typo'd id fails the static CI check instead of 404-ing at runtime.
//
// The list holds the Gemini 2.5-family ids known valid as of this project's
// baseline. IMPORTANT: model availability moves fast — RE-VERIFY every id
// against live Google docs (https://ai.google.dev/gemini-api/docs/models)
// before trusting or extending this list.
//
// History: four fabricated `gemini-3.x-flash` ids — including `gemini-3.7-flash`,
// which CLAUDE.md explicitly flags as invalid — were removed here. An allowlist
// that sanctions a non-existent model id defeats the very purpose of the guard.

/** The pinned model the server calls. Must be a member of ALLOWLIST. */
export const MODEL_ID = 'gemini-2.5-flash';

/** Gemini 2.5-family model ids known valid at baseline (re-verify before adding). */
export const ALLOWLIST = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const;

// Invariant: the pinned id is always a member of the allowlist.
if (!ALLOWLIST.includes(MODEL_ID)) {
  throw new Error(`MODEL_ID "${MODEL_ID}" is not in the verified ALLOWLIST`);
}
