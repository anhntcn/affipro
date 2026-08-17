---
phase: 00-fix-to-run-ci-net
plan: 01
subsystem: api
tags: [gemini, zod, vitest, supertest, express, structured-output, testing]

# Dependency graph
requires:
  - phase: baseline (b576181)
    provides: existing Express /api/generate handler, src/types.ts contract, React SPA
provides:
  - "src/schema/modelAllowlist.ts exporting MODEL_ID (gemini-2.5-flash) and ALLOWLIST of six verified-valid ids"
  - "src/schema/generatedContent.ts exporting GeneratedContentSchema (Zod) mirroring src/types.ts"
  - "server.ts exporting Vite-free createApp() + re-exported MODEL_ID, separate from startServer()"
  - "vitest.config.ts (single global node environment)"
  - "tests/api.generate.test.ts happy-path + allowlist integration test (mocked SDK)"
  - "typed responseSchema + server-side Zod double-guard on /api/generate"
affects: [00-02, 00-03, 00-04, failure-handling, ci, client-resilience]

# Tech tracking
tech-stack:
  added: [zod, vitest, supertest, "@vitest/coverage-v8", "@testing-library/react", jsdom]
  patterns:
    - "Testable Express seam: export createApp() (Vite-free) separately from startServer()"
    - "Entry guard via import.meta.url === pathToFileURL(process.argv[1]).href so import never boots Vite"
    - "Double-guard model output: Gemini responseSchema + server-side Zod safeParse before res.json"
    - "Single-source model id constant imported by handler AND (future) CI allowlist check"
    - "Mocked-SDK integration test with supertest (vi.mock @google/genai)"

key-files:
  created:
    - src/schema/modelAllowlist.ts
    - src/schema/generatedContent.ts
    - vitest.config.ts
    - tests/api.generate.test.ts
    - .planning/phases/00-fix-to-run-ci-net/deferred-items.md
  modified:
    - server.ts
    - package.json
    - bun.lock

key-decisions:
  - "Pinned MODEL_ID = gemini-2.5-flash (D-01, user-confirmed); gemini-3.7-flash retained in allowlist as verified-valid"
  - "z.coerce.number() for scene_number (Pitfall 4) so string-or-number model output validates"
  - "Entry guard uses Node url.pathToFileURL (Windows-safe) instead of hand-rolled file:// construction"
  - "Test mocks GoogleGenAI as a real class (new-able), not a vi.fn arrow wrapper"
  - "Added test script (vitest run) to package.json (RESEARCH Wave 0 requirement)"

patterns-established:
  - "createApp() Vite-free app for in-process supertest testing"
  - "Model output treated as untrusted: responseSchema + Zod double-guard, non-2xx on failure without leaking internals"

requirements-completed: [FIX-01, FIX-02]

coverage:
  - id: D1
    description: "Gemini call uses a single pinned MODEL_ID that is a member of the verified ALLOWLIST (no gemini-2.0 id)"
    requirement: "FIX-01"
    verification:
      - kind: unit
        ref: "tests/api.generate.test.ts#model id is a member of the allowlist"
        status: pass
      - kind: other
        ref: "grep -oE \"'gemini-[^']+'\" src/schema/modelAllowlist.ts | grep -c gemini-2.0 == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "User generates content end-to-end and receives 200 with full 4-channel JSON body (happy path)"
    requirement: "FIX-02"
    verification:
      - kind: integration
        ref: "tests/api.generate.test.ts#happy path returns validated 200 with the full 4-channel body"
        status: pass
    human_judgment: false
  - id: D3
    description: "Model output constrained by typed responseSchema AND re-validated by Zod server-side before reaching client"
    requirement: "FIX-02"
    verification:
      - kind: unit
        ref: "ad-hoc tsx check: GeneratedContentSchema.safeParse valid=success, missing facebook_threads=fail, scene_number '1'->1"
        status: pass
      - kind: integration
        ref: "tests/api.generate.test.ts#happy path (200 only returned after safeParse success)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Express app importable in a test without booting Vite or calling listen()"
    requirement: "FIX-02"
    verification:
      - kind: integration
        ref: "bunx vitest run tests/api.generate.test.ts completes ~1.3s, no Vite startup lines"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-17
status: complete
---

# Phase 0 Plan 1: Testable Seam + Happy Path Summary

**Refactored `server.ts` into a Vite-free `createApp()`, pinned the Gemini model behind a shared `MODEL_ID`/`ALLOWLIST`, added a `responseSchema` + server-side Zod double-guard on `/api/generate`, and proved the whole path with a passing mocked-SDK integration test.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-17T09:05:53Z
- **Completed:** 2026-08-17T09:11:40Z
- **Tasks:** 3
- **Files modified:** 8 (3 modified, 5 created)

## Accomplishments
- Pinned the Gemini model id in one shared constant (`MODEL_ID = gemini-2.5-flash`) plus an `ALLOWLIST` of six build-time-verified ids (no `gemini-2.0` family), with a dated verification comment for the next editor.
- Refactored `server.ts` so the Express app is importable in tests: `createApp()` builds a Vite-free app (32kb body cap); `startServer()` keeps Vite/static + `listen()`; an `import.meta.url` entry guard means importing the module never boots Vite.
- Added a Zod contract (`GeneratedContentSchema`) mirroring `src/types.ts` exactly (snake_case, `z.coerce.number()` for `scene_number`) and wired it as a server-side double-guard after a typed `responseSchema` — the handler returns 200 only on `safeParse` success and a clean non-2xx JSON error otherwise (no internals leaked).
- Stood up Vitest 4 (single global `node` environment, no removed `environmentMatchGlobs`) + Supertest with a mocked `@google/genai`, and a happy-path test asserting a validated 200 with the full 4-channel body plus an allowlist-membership test. Run finishes in ~1.3s with no Vite startup.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps + pin model behind shared allowlist** - `6d6b822` (feat)
2. **Task 2: Zod contract + refactor server to testable createApp() with double-guard** - `9730a86` (feat)
3. **Task 3: Vitest config + happy-path integration test** - `b1a4663` (test)

**Plan metadata:** committed with SUMMARY + STATE + ROADMAP + REQUIREMENTS (docs commit)

## Files Created/Modified
- `src/schema/modelAllowlist.ts` (created) - `MODEL_ID` + `ALLOWLIST` single source of truth, dated verification comment, runtime invariant that `MODEL_ID ∈ ALLOWLIST`.
- `src/schema/generatedContent.ts` (created) - `GeneratedContentSchema` (Zod) mirroring `src/types.ts`; `scene_number` coerced; inferred type export.
- `vitest.config.ts` (created) - single global `environment: "node"`, `tests/**` include.
- `tests/api.generate.test.ts` (created) - mocked-SDK happy-path 200 test + allowlist membership test.
- `server.ts` (modified) - exported `createApp()` + re-exported `MODEL_ID`; `responseSchema`; Zod double-guard; entry guard; 32kb body cap; replaced hardcoded `gemini-3.7-flash`.
- `package.json` (modified) - added `zod` (dep); `vitest`/`supertest`/`@vitest/coverage-v8`/`@testing-library/react`/`jsdom` (dev); `test` script.
- `bun.lock` (modified) - lockfile updated by Bun (no `package-lock.json` created).
- `.planning/phases/00-fix-to-run-ci-net/deferred-items.md` (created) - logged out-of-scope pre-existing duplicate `vite` dependency.

## Decisions Made
- Pinned `gemini-2.5-flash` per D-01 (user-confirmed); kept `gemini-3.7-flash` and other verified ids in the allowlist.
- Used Node's `url.pathToFileURL` for the entry guard rather than hand-constructing a `file://` URL — the initial hand-rolled version was Windows-path-fragile (fixed before commit, Rule 1 preventive).
- Added a `test` script to `package.json` (listed in RESEARCH §Wave 0 gaps and needed by later plans/CI) even though not spelled out in Task 1's action.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mocked GoogleGenAI must be `new`-able**
- **Found during:** Task 3 (integration test)
- **Issue:** `vi.mock` factory used `GoogleGenAI: vi.fn(() => ({...}))`; `server.ts` calls `new GoogleGenAI(...)`, and a vi.fn arrow wrapper is not a constructor → `TypeError: ... is not a constructor`, test got 500 instead of 200.
- **Fix:** Mocked `GoogleGenAI` as a real `class` exposing `models.generateContent = mockGenerate`; kept `mockGenerate` as the asserted/reset `vi.fn()`.
- **Files modified:** tests/api.generate.test.ts
- **Verification:** `bunx vitest run tests/api.generate.test.ts` → 2 passed; happy path returns 200.
- **Committed in:** `b1a4663` (Task 3 commit)

**2. [Rule 1 - Bug] Windows-safe entry guard**
- **Found during:** Task 2 (server refactor)
- **Issue:** First draft hand-rolled `file://` URL construction for the `import.meta.url` entry guard, which is fragile across Windows drive-letter/backslash paths.
- **Fix:** Switched to Node's `url.pathToFileURL(process.argv[1]).href`.
- **Files modified:** server.ts
- **Verification:** `bunx tsc --noEmit` passes; import in tests does not boot Vite; no unconditional `startServer()`.
- **Committed in:** `9730a86` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, both Rule 1).
**Impact on plan:** Both fixes were mechanical correctness fixes within the plan's own deliverables. No scope creep; all plan artifacts delivered as specified.

## Issues Encountered
- Bun surfaced a pre-existing "Duplicate dependency: vite" warning (vite listed in both `dependencies` and `devDependencies`). Out of scope for this plan — logged to `deferred-items.md` for the FIX-05 cleanup work, not fixed here.

## User Setup Required
None - no external service configuration required. (Live end-to-end generation needs a real `GEMINI_API_KEY`, but tests mock the SDK and require no key.)

## Next Phase Readiness
- `createApp()` is importable and testable; `MODEL_ID`/`ALLOWLIST` and `GeneratedContentSchema` are exported from shared modules — the foundation Plans 00-02 (failure handling / retry / Vietnamese errors), 00-03 (client resilience + render test), and 00-04 (CI net + allowlist script) depend on.
- No blockers. GitHub remote for Actions (D-09) remains a prerequisite handled in the CI plan (00-04).

## Known Stubs
None - no stub/placeholder patterns present in this plan's files.

## Threat Flags
None - no security surface introduced beyond the plan's `<threat_model>` (responseSchema+Zod double-guard for T-00-01, 32kb cap for T-00-02, server-side key for T-00-04 all implemented as planned).

## Self-Check: PASSED

All created files exist on disk (`src/schema/modelAllowlist.ts`, `src/schema/generatedContent.ts`, `vitest.config.ts`, `tests/api.generate.test.ts`, `00-01-SUMMARY.md`) and all task commits exist in git history (`6d6b822`, `9730a86`, `b1a4663`).

---
*Phase: 00-fix-to-run-ci-net*
*Completed: 2026-08-17*
