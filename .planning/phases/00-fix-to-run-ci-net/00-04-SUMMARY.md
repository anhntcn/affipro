---
phase: 00-fix-to-run-ci-net
plan: 04
subsystem: infra
tags: [ci, github-actions, bun, vitest, gemini, allowlist, onboarding]

# Dependency graph
requires:
  - phase: 00-01
    provides: src/schema/modelAllowlist.ts (MODEL_ID + ALLOWLIST single source of truth)
  - phase: 00-02
    provides: Vitest suite (mocked @google/genai SDK, config + safety tests)
  - phase: 00-03
    provides: malformed/unguarded-parse crash-proofing tests
provides:
  - Static model-id allowlist CI check (scripts/check-model-allowlist.mjs) — no quota, no key
  - GitHub Actions workflow (.github/workflows/ci.yml) running tsc + vitest + allowlist on push/PR
  - package.json test + check:model scripts and real project name (affipro)
  - .env.local.example documenting GEMINI_API_KEY (server-side only) + optional PORT
  - Real app identity in index.html / metadata.json / README.md (AI Studio template removed)
affects: [public-launch, rate-limit-quota, future-server-rewrites]

# Tech tracking
tech-stack:
  added: [github-actions, oven-sh/setup-bun]
  patterns:
    - "Static CI guard: import the TS single-source-of-truth and assert an invariant with no network call"
    - "Bun as CI runtime: bun install --frozen-lockfile + bunx for tsc/vitest; bun <file> for local .ts-importing scripts"

key-files:
  created:
    - scripts/check-model-allowlist.mjs
    - .github/workflows/ci.yml
    - .env.local.example
  modified:
    - package.json
    - index.html
    - metadata.json
    - README.md
    - .gitignore

key-decisions:
  - "Invoke the allowlist script with `bun <file>` not `bunx <file>` — bunx treats its arg as a package to download and 404s on a local path"
  - "Un-ignore only .env.local.example in .gitignore; all real .env* files stay ignored"
  - "CI pins actions/checkout@v4 and oven-sh/setup-bun@v2 and uses --frozen-lockfile (supply-chain, T-00-SC)"

patterns-established:
  - "Model-id regression guard: every push/PR asserts MODEL_ID ∈ ALLOWLIST statically before merge"
  - "No Gemini secret in CI: SDK mocked in tests, allowlist check is static (D-10)"

requirements-completed: [FIX-01, FIX-05, FIX-06]

coverage:
  - id: D1
    description: "Static model-id allowlist check asserts MODEL_ID ∈ ALLOWLIST with no network call / no GEMINI key; a bad id exits non-zero"
    requirement: FIX-01
    verification:
      - kind: automated_ui
        ref: "bun scripts/check-model-allowlist.mjs (exit 0 valid; exit 1 on temporary bad id spot-check)"
        status: pass
    human_judgment: false
  - id: D2
    description: "package.json test script runs the one-shot Vitest suite (12 tests, 3 files) green"
    requirement: FIX-06
    verification:
      - kind: unit
        ref: "bunx vitest run (Test Files 3 passed, Tests 12 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GitHub Actions CI workflow runs tsc + vitest + allowlist on push/PR with no Gemini secret"
    requirement: FIX-01
    verification:
      - kind: manual_procedural
        ref: ".github/workflows/ci.yml — greps: frozen-lockfile, vitest run, check-model-allowlist present; GEMINI_API_KEY absent; the three commands pass locally"
        status: pass
    human_judgment: true
    rationale: "The workflow only truly runs once a push/PR reaches the GitHub remote; local greps + local command runs prove intent but a first live CI run should confirm the green build."
  - id: D4
    description: ".env.local.example documents GEMINI_API_KEY (server-side only) + optional PORT; README references it"
    requirement: FIX-05
    verification:
      - kind: manual_procedural
        ref: ".env.local.example exists and is tracked; README copy-to-.env.local step present"
        status: pass
    human_judgment: false
  - id: D5
    description: "AI Studio template metadata replaced with real Affipro identity in index.html, metadata.json, package.json name, README"
    requirement: FIX-05
    verification:
      - kind: manual_procedural
        ref: "grep: no 'My Google AI Studio App' / 'An application built with Google AI Studio' in index.html; no 'react-example' in package.json; no ai.studio/apps url in README; bun install instructions present"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-08-17
status: complete
---

# Phase 0 Plan 04: CI Net + Template Cleanup Summary

**GitHub Actions CI (Bun install + tsc + full Vitest + static model-id allowlist) locks the Phase 0 fixes against regression, and the AI Studio template scaffolding is replaced with the real Affiliate Content Pro identity.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-17T09:25:00Z
- **Completed:** 2026-08-17T09:35:10Z
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- Static `scripts/check-model-allowlist.mjs` asserts the pinned `MODEL_ID` is in `ALLOWLIST` with no network call and no `GEMINI_API_KEY` — a reintroduced bad/unknown model id fails the build without spending Gemini quota (FIX-01, T-00-11).
- `.github/workflows/ci.yml` runs on every push/PR: `bun install --frozen-lockfile`, then `bunx tsc --noEmit`, `bunx vitest run` (full suite catches unguarded-parse regressions, T-00-12), and the allowlist check — with no Gemini secret (T-00-13, D-10) and pinned action versions (T-00-SC).
- `package.json` wired with `test` (already present) + `check:model`; project renamed `react-example` → `affipro`.
- `.env.local.example` documents `GEMINI_API_KEY` (server-side only) + optional `PORT`; README rewritten with Bun instructions referencing it.
- All AI Studio template metadata removed from `index.html`, `metadata.json`, and `README.md`; replaced with the real Affipro identity (T-00-14).

## Task Commits

Each task was committed atomically:

1. **Task 1: Static model-id allowlist check + check:model script** - `97423dc` (feat)
2. **Task 2: GitHub Actions CI workflow** - `e4b4ba0` (ci)
3. **Task 3: .env.local.example + strip AI Studio template metadata** - `8139f79` (chore)

**Plan metadata:** committed with SUMMARY/STATE/ROADMAP/REQUIREMENTS (docs)

## Files Created/Modified
- `scripts/check-model-allowlist.mjs` - Static assertion MODEL_ID ∈ ALLOWLIST; exits non-zero on violation
- `.github/workflows/ci.yml` - CI: Bun install + tsc + vitest + allowlist on push/PR, no Gemini secret
- `.env.local.example` - Documents GEMINI_API_KEY (server-side only) + optional PORT
- `package.json` - Added `check:model` script; name `react-example` → `affipro`
- `index.html` - Real title + description/OG meta (Affiliate Content Pro)
- `metadata.json` - Real name + Vietnamese description (kept majorCapabilities)
- `README.md` - Rewritten for the real project with Bun run instructions + `.env.local.example`
- `.gitignore` - Un-ignore `.env.local.example` only (real `.env*` stay ignored)

## Decisions Made
- **Allowlist invocation uses `bun <file>`, not `bunx <file>`.** The plan mandated `bunx scripts/check-model-allowlist.mjs`, but `bunx` treats its first argument as an npm package to download and returns HTTP 404 on a local path. `bun scripts/check-model-allowlist.mjs` runs the local file and resolves the `.ts` import directly (the intended behavior — Bun as runtime so a `.ts` import works where plain `node` cannot). Used identically in `package.json` `check:model` and the CI workflow step.
- Un-ignored only `.env.local.example` in `.gitignore` so the onboarding template can be committed while every real `.env*` (including `.env.local`) stays out of git.
- Kept CI minimal (no coverage gate, no deploy) with pinned action versions and `--frozen-lockfile` for supply-chain integrity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Allowlist invocation form corrected from `bunx` to `bun`**
- **Found during:** Task 1 (allowlist check verification)
- **Issue:** The plan's mandated `bunx scripts/check-model-allowlist.mjs` fails — `bunx` interprets the path as a package name and returns `404 GET .../scripts/check-model-allowlist.mjs/tarball`, so the FIX-01 guard would never run. The plan's stated intent (run the local script through Bun so the `.ts` import resolves) is only achieved by `bun <file>`.
- **Fix:** Used `bun scripts/check-model-allowlist.mjs` consistently in the script's own doc comment, `package.json` `check:model`, and the `ci.yml` allowlist step (still byte-identical between the two invocation sites, satisfying the plan's match requirement).
- **Files modified:** scripts/check-model-allowlist.mjs, package.json, .github/workflows/ci.yml
- **Verification:** Positive run exits 0; temporary bad-id spot-check exits 1; reverted cleanly.
- **Committed in:** 97423dc (Task 1) and e4b4ba0 (Task 2)

**2. [Rule 3 - Blocking] `.gitignore` exception added so `.env.local.example` can be tracked**
- **Found during:** Task 3 (staging `.env.local.example`)
- **Issue:** `.gitignore` line 7 `.env*` ignores the new `.env.local.example`, and only `.env.example` was un-ignored — so `git add .env.local.example` was a no-op. The plan requires this example to be committed and referenced by the README.
- **Fix:** Added `!.env.local.example` after the existing `!.env.example`. Real secret files (`.env`, `.env.local`) remain ignored.
- **Files modified:** .gitignore
- **Verification:** `git check-ignore -v .env.local.example` now resolves to the negation rule; file is staged/tracked (mode 100644).
- **Committed in:** 8139f79 (Task 3)

**3. [Rule 3 - Blocking] CI comment reworded to avoid the literal `GEMINI_API_KEY` string**
- **Found during:** Task 2 (workflow verification)
- **Issue:** A descriptive comment ("No GEMINI_API_KEY / secret is configured") tripped the plan's `! grep -q 'GEMINI_API_KEY'` gate, which cannot distinguish a comment from a secret reference.
- **Fix:** Reworded the comment to "No Gemini API key / secret is configured"; no functional change.
- **Files modified:** .github/workflows/ci.yml
- **Verification:** `grep GEMINI_API_KEY .github/workflows/ci.yml` returns no match.
- **Committed in:** e4b4ba0 (Task 2)

---

**Total deviations:** 3 auto-fixed (3 blocking / Rule 3)
**Impact on plan:** All three preserve the plan's intent (the allowlist guard runs, the example is committed, no secret in CI). No scope creep; the `bunx`→`bun` correction is essential — without it the FIX-01 CI guard would never execute.

## Issues Encountered
- None beyond the deviations above. The `.env.example` and `.env.local.example` paths are outside the Bash tool's permitted scope; verification for those files used the Read/Write/Grep tools and `git check-ignore` instead of shell `grep`/`ls`.

## User Setup Required
None - no external service configuration required. CI activates automatically on the next push/PR to the existing `origin` remote (`git@github.com:anhntcn/affipro.git`); no remote setup or push was performed by this plan.

## Next Phase Readiness
- The whole Phase 0 correctness net is now enforceable in CI: a reintroduced bad model id (allowlist) or an unguarded-parse regression (Vitest) fails the build before merge.
- Onboarding is clean: real app identity + `.env.local.example` + Bun instructions.
- Deferred to public-launch (PUB-0x, out of Phase 0 scope): `0.0.0.0` bind hardening and rate-limit/quota — documented-accepted.

## Self-Check: PASSED

All created/modified files exist on disk (or are git-tracked, for `.env.local.example`) and all three task commits (`97423dc`, `e4b4ba0`, `8139f79`) are present in git history.

---
*Phase: 00-fix-to-run-ci-net*
*Completed: 2026-08-17*
