---
phase: 0
slug: fix-to-run-ci-net
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-17
validated: 2026-08-17
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 00-RESEARCH.md §"Validation Architecture"; audited by validate-phase after execution.
> **Audit result:** all automatable requirements (FIX-01…FIX-05, FIX-06 command-set) are COVERED by
> green automated tests. Two verifications are inherently manual (live Gemini generation; actual
> GitHub Actions trigger) → classified **PARTIAL** rather than fully nyquist-compliant.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.10` + Supertest + `@testing-library/react` (installed in Wave 1) |
| **Config file** | `vitest.config.ts` — single global `node` environment; render test opts into jsdom via a per-file `// @vitest-environment jsdom` docblock (Vitest 4 removed `environmentMatchGlobs`) |
| **Quick run command** | `bunx vitest run <the-file-touched>` + `bunx tsc --noEmit` |
| **Full suite command** | `bun run test` (`vitest run`) + `bunx tsc --noEmit` + `bun scripts/check-model-allowlist.mjs` |
| **Actual suite** | 3 test files · **14 tests** · all green · ~3.5 s (mocked SDK, no network) |

Package manager standardized on **Bun** (`bun.lock`); CI uses `bun install --frozen-lockfile`.

---

## Sampling Rate

- **After every task commit:** `bunx vitest run <the-file-touched>` + `bunx tsc --noEmit`
- **After every plan wave:** `bun run test` (full) + `bunx tsc --noEmit`
- **Before `/gsd-verify-work`:** full Vitest suite green + allowlist check green + one manual live end-to-end generation with a real `GEMINI_API_KEY` (outside CI)
- **Max feedback latency:** ~4 seconds (measured)

---

## Per-Task Verification Map

| Requirement | Behavior | Threat Ref | Test Type | Test / Command | Status |
|-------------|----------|------------|-----------|----------------|--------|
| FIX-01 | Model id in `server.ts` ∈ static allowlist (`gemini-2.5-flash` pinned) | T-00-11 | unit + CI check | `tests/api.generate.test.ts` "model id is a member of the allowlist" + `bun scripts/check-model-allowlist.mjs` (exit 1 on bad id — proven) | ✅ green |
| FIX-02 | Valid Gemini JSON → Zod passes → 200 with 4-channel body | T-00-01 | integration (mocked SDK) | `tests/api.generate.test.ts` "happy path returns validated 200 with the full 4-channel body" | ✅ green |
| FIX-03 | Truncated/malformed/blocked response → clear VN error, no crash, no leak; bounded single retry; deterministic blocks never retried | T-00-05/06/07 | integration (mocked SDK) | `tests/api.generate.test.ts` — MAX_TOKENS retry→200, both-fail, SAFETY no-retry, **PROHIBITED_CONTENT no-retry**, PARSE retry, SCHEMA not-retried; all assert `assertNoLeak` | ✅ green |
| FIX-03 | Zod `safeParse` rejects wrong-shape output server-side | T-00-01 | integration | `tests/api.generate.test.ts` "valid JSON but wrong shape → 400, called ONCE (SCHEMA not retried)" | ✅ green |
| FIX-04 | `ResultDisplay` renders a missing-field payload without crashing; ErrorBoundary catches a throwing child | T-00-09/10 | render (jsdom) | `tests/ResultDisplay.test.tsx` | ✅ green |
| FIX-05 | `loadEnv()` fails fast on missing `GEMINI_API_KEY`; `PORT` from env and rejected when non-numeric | T-00-08 | unit | `tests/config.test.ts` — default PORT, coerce PORT, **missing-key fail-fast**, **non-numeric-PORT fail-fast** | ✅ green |
| FIX-06 | CI runs `tsc` + Vitest + allowlist on push/PR | T-00-11/12/13 | CI config + local smoke | `.github/workflows/ci.yml` present & correct; all three commands run green locally. Actual GitHub trigger → **Manual-Only** (needs a push) | ✅ config / ⚠️ trigger manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/manual*

---

## Wave 0 (foundation) — delivered

- [x] `server.ts` refactored to `createApp()` / handler separate from `startServer()` (Vite-free, importable)
- [x] Vitest + Supertest + `@testing-library/react` + jsdom installed
- [x] `vitest.config.ts` — single `node` env; render test uses jsdom docblock
- [x] `src/schema/generatedContent.ts` — Zod schema mirroring `src/types.ts`
- [x] `src/schema/modelAllowlist.ts` — `MODEL_ID` + `ALLOWLIST` (trimmed to real ids post-review)
- [x] `scripts/check-model-allowlist.mjs` — static allowlist CI check (FIX-01)
- [x] `tests/api.generate.test.ts` — FIX-02, FIX-03, FIX-01(allowlist)
- [x] `tests/config.test.ts` — FIX-05 fail-fast + PORT
- [x] `tests/ResultDisplay.test.tsx` — FIX-04 render-with-missing-fields (jsdom)
- [x] `.github/workflows/ci.yml` — FIX-06 (Bun install + tsc + vitest + allowlist)
- [x] `"test": "vitest run"` added to `package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real end-to-end generation against the live Gemini API with a valid `gemini-2.5-flash` key | FIX-01, FIX-02 | CI mocks the SDK (no key/quota in CI); the live model id + real 4-channel output can only be confirmed against the real API | Set `GEMINI_API_KEY` locally, run the app, generate for one product, confirm all 4 channels render |
| GitHub Actions actually runs on push/PR | FIX-06 | Requires the `origin` remote to receive a push (remote exists but nothing pushed yet) | Push a branch, open a PR, confirm the `ci` workflow runs green |

---

## Validation Sign-Off

- [x] All requirements have automated verification OR a documented manual-only reason
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered all MISSING references (all foundation items delivered)
- [x] No watch-mode flags (CI uses `vitest run`, not watch)
- [x] Feedback latency < 20s (~4s measured)
- [ ] `nyquist_compliant: true` — **not set**: 2 inherently-manual verifications remain (live API, actual CI trigger)

**Approval:** validated (PARTIAL) — 2026-08-17

---

## Validation Audit 2026-08-17

| Metric | Count |
|--------|-------|
| Requirements audited | 6 (FIX-01…FIX-06) |
| Fully automated (COVERED, green) | 5 (FIX-01…FIX-05) + FIX-06 command-set |
| Manual-only (documented, inherent) | 2 (live-API generation; actual GitHub Actions trigger) |
| Gaps filled by auditor | 0 (no MISSING/red automated coverage — auditor not required) |
| Escalated impl bugs | 0 |

Run by: gsd validate-phase (State A audit; no gap-fill needed — all automatable behavior already green at 14/14).
