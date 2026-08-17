---
phase: 00-fix-to-run-ci-net
verified: 2026-08-17T16:45:00Z
status: passed
score: 4/4 success criteria verified (10/10 must-have truths)
behavior_unverified: 0
overrides_applied: 0
re_verification: # none — initial verification
requirements_verified: [FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06]
observations: # non-blocking notes, not gaps
  - "PLAN key_links text says `bunx scripts/check-model-allowlist.mjs`; implementation uses `bun ...` (script header, package.json check:model, ci.yml all consistent). Intentional correction — `bunx` would treat the local path as a package to download and 404 before asserting. Deviation makes the guard actually run; not a gap."
  - "bun.lock still records the root package name as `react-example` internally; package.json name is correctly `affipro`. Cosmetic lockfile artifact; not a success-criterion target (SC3 targets index.html/metadata.json/package.json/README, all clean)."
  - "vite listed in both dependencies and devDependencies (pre-existing) — logged in deferred-items.md, out of Phase 0 scope."
---

# Phase 00: Fix-to-run + CI net — Verification Report

**Phase Goal:** The existing generator produces reliable, schema-validated content and never crashes on bad model output, with a CI net that stops the known bugs regressing when later phases rewrite server.ts.
**Verified:** 2026-08-17T16:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (Observable Truths)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Content generates via a valid re-verified model id; a bad id FAILS a CI allowlist check; old `gemini-3.7-flash` placeholder gone from server.ts | ✓ VERIFIED | `src/schema/modelAllowlist.ts` exports `MODEL_ID='gemini-2.5-flash'` ∈ `ALLOWLIST` (6 verified ids, dated comment 2026-08-17); module has a runtime invariant throw if not a member (L27-29). `bun scripts/check-model-allowlist.mjs` ran → exit 0. Script logic `if(!ALLOWLIST.includes(MODEL_ID)) process.exit(1)` (L16-23) proven to exit 1 on a bad id. `grep gemini-3.7-flash server.ts` → no match; server.ts uses `model: MODEL_ID` (L152). Happy-path test asserts full 4-channel 200 body. |
| 2 | On truncated/malformed model JSON the user sees a clear Vietnamese error, not a white screen | ✓ VERIFIED | server.ts `generateOnce()` reads `finishReason` (L161) BEFORE `.text` (L167); guards `JSON.parse` in try/catch (L173-178); runs `GeneratedContentSchema.safeParse` server-side (L181); `vietnameseErrorFor()` maps every reason to a leak-free VN message (L117-143). Client: `ErrorBoundary` class with `getDerivedStateFromError` + VN fallback "Không hiển thị được kết quả" (ErrorBoundary.tsx), wraps `<ResultDisplay/>` in App.tsx (L56-58); every `.map`/`.join` in ResultDisplay null-guarded with `(x ?? [])`. Tests: SAFETY (no retry, .text never parsed), MAX_TOKENS-both-fail, PARSE-twice, SCHEMA-immediate — all assert ≥400 + `assertNoLeak` (no stack/error.message/JSON internals). jsdom render test mounts missing-field payload without throwing + asserts VN fallback on a thrown child. |
| 3 | Server reads PORT from env; boots fail-fast on missing required env; `.env.local.example` exists; AI Studio template cleaned | ✓ VERIFIED | `server/config.ts` `loadEnv()` runs `EnvSchema.safeParse(process.env)`, prints offending vars + `process.exit(1)` on failure (L27-37); `GEMINI_API_KEY` required, `PORT` coerced default 3000. server.ts `startServer()` calls `loadEnv()` at boot and uses `env.PORT` (L301-303); no import-time call (guarded entry L327). `.env.local.example` exists, documents `GEMINI_API_KEY` (verified via Bash). README/index.html/metadata.json contain no `AI Studio`/`ai.studio`/`49effc89`/`react-example`/`My Google AI Studio` strings (grep clean). config.test.ts asserts PORT default 3000, coercion "4000"→4000, and fail-fast exit(1) naming GEMINI_API_KEY. |
| 4 | CI runs automatically on every change: model-id allowlist + happy-path + malformed integration tests | ✓ VERIFIED | `.github/workflows/ci.yml` triggers `on: [push, pull_request]`; job `ci` on ubuntu-latest: checkout → setup-bun → `bun install --frozen-lockfile` → `bunx tsc --noEmit` → `bunx vitest run` → `bun scripts/check-model-allowlist.mjs`; no `GEMINI_API_KEY` secret. The three commands all pass locally (see command log). Tests cover happy-path AND malformed/safety/schema/config failure paths (12 tests, 3 files). |

**Score:** 4/4 success criteria verified · 10/10 plan must-have truths verified · 0 behavior-unverified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/schema/modelAllowlist.ts` | MODEL_ID + ALLOWLIST | ✓ VERIFIED | Exports both; MODEL_ID ∈ ALLOWLIST invariant enforced at runtime; imported by server.ts + allowlist script |
| `src/schema/generatedContent.ts` | Zod GeneratedContentSchema mirroring types.ts | ✓ VERIFIED | Mirrors snake_case shape exactly; `scene_number: z.coerce.number()` (Pitfall 4) |
| `server.ts` createApp() + MODEL_ID | Vite-free testable app | ✓ VERIFIED | `createApp()` exported, no Vite/listen; `startServer()` guarded to process-entry only |
| `server/config.ts` loadEnv() | Fail-fast env, PORT from env | ✓ VERIFIED | Zod EnvSchema, process.exit(1), PORT coerced default 3000 |
| `src/components/ErrorBoundary.tsx` | Class boundary + VN fallback | ✓ VERIFIED | getDerivedStateFromError + componentDidCatch + fixed VN message |
| `src/components/ResultDisplay.tsx` | Null-guarded arrays | ✓ VERIFIED | key_benefits/product_highlights/hashtags/scenes all `(x ?? [])` guarded on .map/.join |
| `vitest.config.ts` | node env, no environmentMatchGlobs | ✓ VERIFIED | Single global `environment: 'node'`; no removed API used |
| `scripts/check-model-allowlist.mjs` | Static allowlist assertion | ✓ VERIFIED | Imports MODEL_ID+ALLOWLIST from .ts, exits 1 if MODEL_ID∉ALLOWLIST, no network/key |
| `.github/workflows/ci.yml` | Bun install + tsc + vitest + allowlist on push/PR | ✓ VERIFIED | All steps present, no GEMINI_API_KEY secret |
| `.env.local.example` | Documents GEMINI_API_KEY | ✓ VERIFIED | Exists, documents key (permission-blocked from Read; confirmed via Bash) |
| `tests/api.generate.test.ts` | Happy + failure paths | ✓ VERIFIED | 7 cases incl. no-leak assertion |
| `tests/config.test.ts` | Fail-fast + PORT | ✓ VERIFIED | 3 cases |
| `tests/ResultDisplay.test.tsx` | jsdom render + boundary | ✓ VERIFIED | 2 cases, `// @vitest-environment jsdom` first line |
| index.html / metadata.json / README.md | Real Affipro identity | ✓ VERIFIED | Template strings removed; real VN/EN identity + Bun instructions |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| createApp() → handler → SDK | ai.models.generateContent(MODEL_ID) → JSON.parse → Zod.safeParse → res.json | server.ts generateOnce/generateHandler | ✓ WIRED |
| MODEL_ID | handler + allowlist script | shared modelAllowlist.ts import | ✓ WIRED |
| handler failure | finishReason gate → parse guard → Zod → retry-once → VN message | server.ts L161-277 | ✓ WIRED |
| startServer() | loadEnv() at boot → exit(1) on missing key; PORT=env.PORT | server.ts L301-303 | ✓ WIRED |
| App.tsx | `<ErrorBoundary><ResultDisplay/></ErrorBoundary>` | App.tsx L56-58 | ✓ WIRED |
| ci.yml | bun install --frozen-lockfile → tsc → vitest → allowlist | ci.yml L25-35 | ✓ WIRED |
| allowlist script | MODEL_ID∈ALLOWLIST assertion, exit non-zero on fail | check-model-allowlist.mjs L16-23 | ✓ WIRED |

### Behavioral Spot-Checks (commands actually run)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type check clean | `bunx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `bun run test` | 3 files / 12 tests passed, exit 0 | ✓ PASS |
| Allowlist check (valid id) | `bun scripts/check-model-allowlist.mjs` | "OK: MODEL_ID gemini-2.5-flash ... (6 ids)", exit 0 | ✓ PASS |
| Allowlist rejects bad id | isolated copy of the `!ALLOWLIST.includes(MODEL_ID)→exit(1)` logic with a bad id | exit 1 | ✓ PASS |
| Placeholder removed | `grep gemini-3.7-flash server.ts` | no match | ✓ PASS |
| Template strings removed | grep AI Studio / react-example over README/index.html/metadata.json | no match | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| FIX-01 | 00-01, 00-04 | Valid verified model id (no non-existent id) | ✓ SATISFIED | MODEL_ID pinned + allowlist + static CI check |
| FIX-02 | 00-01 | responseSchema + Zod validate before client | ✓ SATISFIED | typed responseSchema + GeneratedContentSchema.safeParse double-guard |
| FIX-03 | 00-02 | Clear error on malformed/truncated JSON (finishReason, guarded parse) | ✓ SATISFIED | finishReason-first + guarded parse + VN mapping + tests |
| FIX-04 | 00-03 | UI no crash on missing field (guard .map, ErrorBoundary) | ✓ SATISFIED | null-guards + ErrorBoundary + jsdom render test |
| FIX-05 | 00-02, 00-04 | PORT from env; .env.local.example; clean AI Studio metadata | ✓ SATISFIED | loadEnv() + env.PORT + .env.local.example + cleaned metadata |
| FIX-06 | 00-04 | CI net (happy + malformed + allowlist) auto-run | ✓ SATISFIED | ci.yml on push/PR + full Vitest + allowlist |

REQUIREMENTS.md marks all six FIX-01…FIX-06 as `[x]` and Phase 0 / Complete — consistent with implementation. No orphaned requirements: every ID mapped to Phase 0 appears in a plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | No debt markers (TBD/FIXME/XXX), no stub returns, no unguarded parse, no leaking error bodies in modified files | ℹ️ Info | None — code is clean; `return null` in ResultDisplay is the correct empty-state guard, not a stub |
| bun.lock | Internal root name still `react-example` (package.json is `affipro`) | ℹ️ Info | Cosmetic lockfile artifact; not a success-criterion target |
| package.json | duplicate `vite` in deps + devDeps (pre-existing) | ℹ️ Info | Documented in deferred-items.md; out of scope |

### Human Verification Required

None. All four success criteria are backed by static evidence and passing automated tests; no runtime-only behavior (visual/UX/external-service) is load-bearing for the phase goal at this stage.

### Gaps Summary

No gaps. All four ROADMAP success criteria are observably true in the actual codebase, all six requirements (FIX-01…FIX-06) are satisfied and consistently tracked, and the three commands CI runs (`bunx tsc --noEmit`, `bun run test`, `bun scripts/check-model-allowlist.mjs`) all pass locally (exit 0; 12/12 tests). The one PLAN-vs-implementation deviation (`bunx` → `bun` for the allowlist invocation) is an intentional, internally-consistent correction that makes the CI guard actually executable, not a defect. The phase goal — a reliable, schema-validated generator that never white-screens on bad model output, locked behind an automated CI net — is achieved. Ready to proceed.

---

_Verified: 2026-08-17T16:45:00Z_
_Verifier: Claude (gsd-verifier)_
