---
phase: 0
slug: fix-to-run-ci-net
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 00-RESEARCH.md §"Validation Architecture". Task IDs reconciled by validate-phase once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` + Supertest `^7.2.2` (NEW — no test runner today) |
| **Config file** | `vitest.config.ts` (or a `test` block in `vite.config.ts`) — added in Wave 0 |
| **Quick run command** | `bunx vitest run <the-file-touched>` + `bunx tsc --noEmit` |
| **Full suite command** | `bunx vitest run` + `bunx scripts/check-model-allowlist.mjs` |
| **Estimated runtime** | ~10–20 seconds (mocked SDK, no network) |

Package manager standardized on **Bun** (`bun.lock`); CI uses `bun install --frozen-lockfile`.

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run <the-file-touched>` + `bunx tsc --noEmit`
- **After every plan wave:** Run `bunx vitest run` (full) + `bunx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full Vitest suite green + allowlist check green + one manual live end-to-end generation with a real `GEMINI_API_KEY` (outside CI)
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Mapped by requirement (plans not yet authored). `File Exists ❌ W0` = created in Wave 0.

| Requirement | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| FIX-01 | Model id used in `server.ts` ∈ static allowlist (`gemini-2.5-flash` pinned) | — | CI blocks a bad/unknown id without spending quota | unit | `bunx vitest run -t "model id is in the allowlist"` + `bunx scripts/check-model-allowlist.mjs` | ❌ W0 | ⬜ pending |
| FIX-02 | Valid Gemini JSON → Zod passes → 200 with 4-channel body | V5 | Model output validated (Zod) before crossing to client | integration (mocked SDK) | `bunx vitest run -t "happy path"` | ❌ W0 | ⬜ pending |
| FIX-03 | Truncated/malformed/safety response → clear error, not crash | V7 | `finishReason` checked before parse; generic VN error, no stack leak | integration (mocked SDK) | `bunx vitest run -t "truncated response"` | ❌ W0 | ⬜ pending |
| FIX-03 | Zod `safeParse` rejects wrong-shape output server-side | V5 | Trust boundary rejects bad shape | unit | `bunx vitest run tests/schema.test.ts` | ❌ W0 | ⬜ pending |
| FIX-04 | `ResultDisplay` renders with missing fields (no crash) | — | Render-time defense against missing fields | render (jsdom) | `bunx vitest run tests/ResultDisplay.test.tsx` | ❌ W0 | ⬜ pending |
| FIX-05 | `loadEnv()` fails fast on missing `GEMINI_API_KEY`; `PORT` read from env | V14 | Misconfigured deploy dies at boot, not on first request | unit | `bunx vitest run tests/config.test.ts` | ❌ W0 | ⬜ pending |
| FIX-06 | CI runs `tsc` + Vitest + allowlist on push/PR | — | Reintroduced bad id / unguarded parse fails the build | CI smoke | GitHub Actions run on PR | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Refactor `server.ts` to export `createApp()` / route handler separately from `startServer()` — **precondition for all integration tests** (current module boots Vite inline, not importable)
- [ ] `bun add -d vitest supertest @testing-library/react jsdom @vitest/coverage-v8` — framework install
- [ ] `vitest.config.ts` (or `vite.config.ts` `test` block) — `environment: "node"` for API tests, `jsdom` for the render test
- [ ] `src/schema/generatedContent.ts` — Zod schema mirroring `src/types.ts` (the validation contract under test)
- [ ] `src/schema/modelAllowlist.ts` — exported `MODEL_ID` + `ALLOWLIST` (shared by handler and CI check)
- [ ] `scripts/check-model-allowlist.mjs` — CI static allowlist check (covers FIX-01)
- [ ] `tests/api.generate.test.ts` — covers FIX-02, FIX-03, FIX-01(allowlist)
- [ ] `tests/config.test.ts` — covers FIX-05 fail-fast + PORT
- [ ] `tests/ResultDisplay.test.tsx` — covers FIX-04 render-with-missing-fields (jsdom)
- [ ] `.github/workflows/ci.yml` — covers FIX-06 (Bun install + tsc + vitest + allowlist)
- [ ] Add `"test": "vitest run"` to `package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real end-to-end generation against the live Gemini API with a valid `gemini-2.5-flash` key | FIX-01, FIX-02 | CI mocks the SDK (D-10, no key/quota in CI); the live model id + real 4-channel output can only be confirmed against the real API | Set `GEMINI_API_KEY` locally, run the app, generate for one product, confirm all 4 channels render |
| GitHub Actions actually runs on push/PR | FIX-06 | Requires the GitHub remote to receive a push (remote already exists: `origin`) | Push a branch, open a PR, confirm the `ci` workflow runs green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (CI uses `vitest run`, not `vitest`/watch)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
