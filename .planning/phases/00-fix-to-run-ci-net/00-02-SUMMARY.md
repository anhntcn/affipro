---
phase: 00-fix-to-run-ci-net
plan: 02
subsystem: api
tags: [gemini, zod, vitest, supertest, express, error-handling, retry, env-validation, i18n-vietnamese]

# Dependency graph
requires:
  - phase: 00-01
    provides: "Vite-free createApp() + startServer() seam, MODEL_ID/ALLOWLIST, GeneratedContentSchema (Zod), vitest.config.ts, mocked-SDK happy-path test"
provides:
  - "server/config.ts exporting loadEnv(): Zod env schema, fail-fast process.exit(1) at boot, PORT coerced from env (default 3000)"
  - "server.ts handler hardened: generateOnce() reads finishReason before .text, guards JSON.parse, Zod double-guard, single bounded retry, Vietnamese error mapping with no internal leakage"
  - "tests/config.test.ts: PORT default/coercion + fail-fast on missing GEMINI_API_KEY"
  - "tests/api.generate.test.ts extended: MAX_TOKENS-retry-success, MAX_TOKENS-both-fail, SAFETY-no-retry, PARSE-twice, SCHEMA-no-retry, no-leak assertion"
affects: [00-03, 00-04, client-resilience, ci, failure-handling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-fast boot env validation via a single Zod EnvSchema (loadEnv), called only in startServer() — never import-time so mocked-SDK tests need no real key"
    - "generateOnce() failure taxonomy: finishReason gate BEFORE .text (Pitfall 3), guarded parse, Zod safeParse, retryable flag per reason"
    - "Bounded single retry only for transient reasons (MAX_TOKENS/OTHER/EMPTY/PARSE); SAFETY/RECITATION/SCHEMA never retried"
    - "Internal reason -> Vietnamese human message mapping; technical detail logged server-side only, never leaked to client (T-00-06)"
    - "Flat outcome shape (not a discriminated union) chosen because tsconfig has no strictNullChecks"

key-files:
  created:
    - server/config.ts
    - tests/config.test.ts
  modified:
    - server.ts
    - tests/api.generate.test.ts

key-decisions:
  - "Used a flat GenerateOutcome shape ({ ok; reason?; retryable?; data? }) instead of a discriminated union — this project's tsconfig has no strictNullChecks, so boolean-literal union narrowing does not work"
  - "SAFETY/RECITATION -> 422 (client can fix by editing input); SCHEMA/PARSE/EMPTY/MAX_TOKENS/OTHER -> 502 (upstream/AI fault, retry later)"
  - "Kept the per-request GEMINI_API_KEY presence check as a defensive fallback; loadEnv() is the primary fail-fast at boot (D-07)"
  - "Vietnamese messages are human-written (no error.message/stack/JSON internals); tests assert the body has only the error key and no leak fingerprints"

patterns-established:
  - "Fail-fast env: loadEnv() Zod-validates process.env at boot and process.exit(1) with a named-variable message on failure"
  - "Untrusted-model-output taxonomy: finishReason-first gate + guarded parse + Zod + single bounded retry + leak-free localized error"

requirements-completed: [FIX-03, FIX-05]

coverage:
  - id: D1
    description: "loadEnv() validates env at boot: returns PORT 3000 by default, coerces PORT from env to a number, and fails fast (process.exit(1)) with a message naming GEMINI_API_KEY when it is missing"
    requirement: "FIX-05"
    verification:
      - kind: unit
        ref: "tests/config.test.ts#returns PORT 3000 by default when a key is present and PORT is unset"
        status: pass
      - kind: unit
        ref: "tests/config.test.ts#coerces PORT from the environment to a number"
        status: pass
      - kind: unit
        ref: "tests/config.test.ts#fails fast (process.exit(1)) with a message naming GEMINI_API_KEY when it is missing"
        status: pass
    human_judgment: false
  - id: D2
    description: "server.ts startServer() calls loadEnv() at boot and reads PORT from env; loadEnv() is never invoked at import time so createApp() tests need no real key"
    requirement: "FIX-05"
    verification:
      - kind: other
        ref: "grep -n loadEnv server.ts => only call site is line 301 inside startServer(); import at line 8; no top-level invocation"
        status: pass
      - kind: integration
        ref: "tests/api.generate.test.ts + tests/config.test.ts import createApp()/loadEnv() with SDK mocked and pass without a real GEMINI_API_KEY"
        status: pass
    human_judgment: false
  - id: D3
    description: "Handler reads finishReason before .text, guards JSON.parse, Zod-validates, retries exactly once only for transient reasons, and never retries SAFETY/RECITATION/SCHEMA"
    requirement: "FIX-03"
    verification:
      - kind: integration
        ref: "tests/api.generate.test.ts#MAX_TOKENS then STOP+valid on retry -> 200 (retried once, succeeded)"
        status: pass
      - kind: integration
        ref: "tests/api.generate.test.ts#MAX_TOKENS on both attempts -> >=400 VN error, called exactly twice"
        status: pass
      - kind: integration
        ref: "tests/api.generate.test.ts#SAFETY -> >=400 VN error, called exactly ONCE (no retry), .text never parsed"
        status: pass
      - kind: integration
        ref: "tests/api.generate.test.ts#malformed JSON text on both attempts -> >=400, no crash (PARSE retryable once)"
        status: pass
      - kind: integration
        ref: "tests/api.generate.test.ts#valid JSON but wrong shape -> >=400 immediately, called ONCE (SCHEMA not retried)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No error response body leaks a stack trace, raw error.message, or JSON-parser output — only a Vietnamese human message under the error key"
    requirement: "FIX-03"
    verification:
      - kind: integration
        ref: "tests/api.generate.test.ts#assertNoLeak (only error key, non-empty VN string, no SyntaxError/'at '/JSON/finishReason substrings) across all failure cases"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-17
status: complete
---

# Phase 0 Plan 2: Failure-Path Hardening + Fail-Fast Boot Summary

**Hardened `/api/generate` with a finishReason-first failure taxonomy (guarded parse, Zod double-guard, single bounded retry, leak-free Vietnamese errors) and moved env validation to a fail-fast `loadEnv()` at boot with PORT read from the environment.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-17T09:15:47Z
- **Completed:** 2026-08-17T09:20:07Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Added `server/config.ts` with `loadEnv()`: a single Zod `EnvSchema` (GEMINI_API_KEY required, PORT coerced default 3000, NODE_ENV enum) that fails fast at boot with `process.exit(1)` and a clear message naming the offending variable — wired into `startServer()` only (never import-time), and `PORT` now comes from the environment instead of the old hardcoded `3000`.
- Refactored the handler into `generateOnce()` that reads `candidates[0].finishReason` BEFORE `response.text` (so a SAFETY block's undefined text never reaches `JSON.parse`), guards the parse, runs the Zod double-guard, and reports a `reason` + `retryable` flag.
- Implemented the bounded retry policy: exactly one retry only for transient reasons (MAX_TOKENS / OTHER / EMPTY / PARSE); SAFETY, RECITATION, and SCHEMA are never retried. Every failure maps to a human-written Vietnamese message (422 for content blocks, 502 for AI/format faults) with technical detail logged server-side only.
- Extended the tests: 5 new failure-path cases (retry-success, both-fail, safety-no-retry, parse-twice, schema-no-retry) with retry-count assertions and a `assertNoLeak()` guard, plus a new `tests/config.test.ts` for fail-fast + PORT coercion. Full suite: 10 tests green, `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fail-fast env config (loadEnv) + PORT from environment** - `fdf7d7c` (feat)
2. **Task 2: finishReason gate + guarded parse + single retry + Vietnamese error mapping** - `36a042e` (feat)
3. **Task 3: Failure-path and config tests (mocked SDK)** - `c4e1349` (test)

**Plan metadata:** committed with SUMMARY + STATE + ROADMAP + REQUIREMENTS (docs commit)

_Note: config test (`tests/config.test.ts`) was committed with Task 1 because Task 1's `<verify>` runs it; the api-test failure cases were committed with Task 3._

## Files Created/Modified
- `server/config.ts` (created) - `loadEnv()` + Zod `EnvSchema`; fail-fast `process.exit(1)` at boot with a variable-naming message; `Env` type export.
- `tests/config.test.ts` (created) - PORT default 3000, PORT coercion to number, fail-fast on missing GEMINI_API_KEY (mocks `process.exit`/`console.error`, restores `process.env` per case).
- `server.ts` (modified) - added failure taxonomy (`FailReason`, `HARD_FAIL_FINISH`), `vietnameseErrorFor()`, `generateOnce()` (finishReason-first, guarded parse, Zod), handler with single bounded retry + leak-free Vietnamese mapping; `startServer()` now calls `loadEnv()` and reads `PORT` from env.
- `tests/api.generate.test.ts` (modified) - added 5 failure-path cases + `assertNoLeak()` helper asserting the body carries only a non-empty Vietnamese `error` string with no stack/error.message/JSON fingerprints.

## Decisions Made
- Used a flat `GenerateOutcome` shape (`{ ok; reason?; retryable?; data? }`) instead of a `{ ok: true } | { ok: false }` discriminated union: this project's `tsconfig.json` does not enable `strictNullChecks`, so boolean-literal union narrowing does not eliminate branches and `tsc` errored. The flat shape keeps `tsc --noEmit` clean while preserving the same runtime contract.
- Status-code split: SAFETY/RECITATION -> 422 (the user can fix by editing the product description); SCHEMA/PARSE/EMPTY/MAX_TOKENS/OTHER -> 502 (AI/upstream fault, retry later).
- Kept the per-request `GEMINI_API_KEY` presence check as a defensive fallback even though `loadEnv()` is the primary fail-fast at boot (Anti-Pattern note in the plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Flat outcome shape to satisfy tsc under non-strict config**
- **Found during:** Task 2 (handler refactor)
- **Issue:** The RESEARCH Pattern 3 example uses a discriminated union `{ ok: true; data } | { ok: false; reason; retryable }`. Because `tsconfig.json` has no `strictNullChecks`, TypeScript would not narrow the union after `if (outcome.ok) return ...`, so `tsc --noEmit` failed with `Property 'retryable'/'reason' does not exist on type '{ ok: true; ... }'`.
- **Fix:** Changed `GenerateOutcome` to a single flat shape with optional failure fields; branch on `ok` explicitly and default `reason` to `"OTHER"` when absent. Same runtime behavior; `tsc` clean.
- **Files modified:** server.ts
- **Verification:** `bunx tsc --noEmit` passes; all 10 tests pass including retry-count and no-leak assertions.
- **Committed in:** `36a042e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3).
**Impact on plan:** Mechanical type-safety adaptation to the project's non-strict tsconfig within this plan's own deliverable. No scope creep; all planned behaviors delivered and tested exactly as specified.

## Issues Encountered
- None beyond the tsc-narrowing issue documented above (resolved via the flat outcome shape).

## User Setup Required
None - no external service configuration required. Tests mock the SDK and require no `GEMINI_API_KEY`. Live end-to-end generation still needs a real key at runtime, and the server now fails fast at boot if it is missing.

## Next Phase Readiness
- The generate seam now returns clear Vietnamese errors for every failure mode and never crashes on truncated/blocked/malformed output — the server-side foundation Plan 00-03 (client resilience: ErrorBoundary + null-guards) builds on, and Plan 00-04 (CI net) will gate.
- No blockers. GitHub remote for Actions (D-09) remains the prerequisite handled in 00-04.

## Known Stubs
None - no stub/placeholder patterns present in this plan's files.

## Threat Flags
None - no security surface introduced beyond the plan's `<threat_model>`. T-00-05 (guarded parse/finishReason gate), T-00-06 (leak-free VN error), T-00-07 (bounded single retry), and T-00-08 (fail-fast loadEnv) are all implemented as planned.

## Self-Check: PASSED

All created/modified files exist on disk (`server/config.ts`, `tests/config.test.ts`, `server.ts`, `tests/api.generate.test.ts`, `00-02-SUMMARY.md`) and all three task commits exist in git history (`fdf7d7c`, `36a042e`, `c4e1349`). Full suite `bunx vitest run` = 10 passed; `bunx tsc --noEmit` clean.

---
*Phase: 00-fix-to-run-ci-net*
*Completed: 2026-08-17*
