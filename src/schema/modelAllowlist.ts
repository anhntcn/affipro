// Gemini model id pin + CI allowlist (single source of truth).
//
// MODEL_ID is imported by the server handler AND asserted by the CI allowlist
// check, so the deployed model id can only ever be one of the verified-valid
// ids below.
//
// VERIFICATION: the six ids in ALLOWLIST were verified against the Google
// Gemini deprecations documentation (ai.google.dev/gemini-api/docs/deprecations)
// on 2026-08-17. The next editor MUST re-verify against live docs rather than
// trust this list — model availability moves fast. Do NOT add any gemini-2.0-*
// id: the gemini-2.0 family was shut down 2026-06-01.

/** The pinned model the server calls. Must be a member of ALLOWLIST. */
export const MODEL_ID = 'gemini-2.5-flash';

/** Verified-valid Gemini model ids (verified 2026-08-17). */
export const ALLOWLIST = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
] as const;

// Invariant: the pinned id is always a member of the allowlist.
if (!ALLOWLIST.includes(MODEL_ID)) {
  throw new Error(`MODEL_ID "${MODEL_ID}" is not in the verified ALLOWLIST`);
}
