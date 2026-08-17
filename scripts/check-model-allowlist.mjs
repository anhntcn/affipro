// Static model-id allowlist check (CI guard for FIX-01).
//
// Asserts that the pinned MODEL_ID the server calls is a member of the verified
// ALLOWLIST. This is a STATIC check: it imports the TypeScript single-source-of-
// truth module directly and performs NO network call and needs NO GEMINI_API_KEY,
// so a reintroduced bad/unknown/shut-down model id fails CI without spending any
// Gemini quota.
//
// INVOCATION: always run via `bun scripts/check-model-allowlist.mjs` (Bun as the
// runtime, NOT `bunx` — `bunx` treats its argument as a package to download and
// would 404 on this local path). Bun resolves the `.ts` import directly; plain
// `node` cannot import a `.ts` file and would throw before this assertion runs.

import { MODEL_ID, ALLOWLIST } from '../src/schema/modelAllowlist.ts';

if (!ALLOWLIST.includes(MODEL_ID)) {
  console.error(
    `[check-model-allowlist] FAIL: MODEL_ID "${MODEL_ID}" is not in the verified ALLOWLIST.\n` +
      `  Allowed ids: ${ALLOWLIST.join(', ')}\n` +
      `  Re-verify the id against ai.google.dev/gemini-api/docs/deprecations and update src/schema/modelAllowlist.ts.`,
  );
  process.exit(1);
}

console.log(
  `[check-model-allowlist] OK: MODEL_ID "${MODEL_ID}" is a member of the verified ALLOWLIST (${ALLOWLIST.length} ids).`,
);
