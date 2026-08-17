---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 00
current_phase_name: fix-to-run-ci-net
status: verifying
stopped_at: Completed 00-04-PLAN.md
last_updated: "2026-08-17T09:36:41.858Z"
last_activity: 2026-08-17
last_activity_desc: Phase 00 execution started
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-17)

**Core value:** Từ một mô tả sản phẩm + link affiliate, tạo ra bộ nội dung đa kênh chất lượng, tự nhiên, đúng tâm lý người mua Việt — nhanh và đáng tin cậy.
**Current focus:** Phase 00 — fix-to-run-ci-net

## Current Position

Phase: 00 (fix-to-run-ci-net) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-08-17 — Phase 00 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 00 P01 | 6min | 3 tasks | 8 files |
| Phase 00 P02 | 5min | 3 tasks | 4 files |
| Phase 00 P03 | 4min | 3 tasks | 4 files |
| Phase 00 P04 | 10min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 0]: Fix runnable bugs + ship a CI test net (model-id allowlist + happy/malformed integration tests) BEFORE auth/DB, so the fragile server.ts bugs can't regress under later rewrites.
- [Phase 0]: The Gemini model id `gemini-3.7-flash` in server.ts must be RE-VERIFIED against live docs at implementation time — do not assume it is invalid; enforce whatever is chosen via allowlist.
- [Phase 1/2]: Two anti-lock-in seams (verifyUser auth, db/client.ts) must land before any per-user feature; SPA uses Supabase SDK for OAuth token only, all data via Express.
- [Phase 2]: Persist an immutable prompt_version + config snapshot from the first generation — the single most important schema decision for the optimization loop.
- [Phase 3]: LLM-judge runs inline behind services/judge.ts seam; judge with a different model + track human-vs-judge agreement to avoid optimizing toward judge bias.
- [Phase ?]: Pinned Gemini MODEL_ID=gemini-2.5-flash (D-01); allowlist retains gemini-3.7-flash + 4 more verified ids
- [Phase ?]: server.ts split into Vite-free createApp() + startServer(); import.meta.url entry guard keeps import test-safe
- [Phase ?]: Model output double-guarded: Gemini responseSchema + server-side Zod safeParse before res.json
- [Phase ?]: 00-02: Flat GenerateOutcome shape (not discriminated union) because tsconfig lacks strictNullChecks
- [Phase ?]: 00-02: SAFETY/RECITATION->422, SCHEMA/PARSE/EMPTY/MAX_TOKENS/OTHER->502; retry once only for transient reasons
- [Phase ?]: 00-03: Client crash-proofing — class ErrorBoundary (Vietnamese fallback) + null-guard every array .map/.join in ResultDisplay; declare props workaround since @types/react absent
- [Phase ?]: 00-04: allowlist script runs via 'bun <file>' not 'bunx' (bunx 404s on local paths)
- [Phase ?]: 00-04: CI has no Gemini secret — SDK mocked in tests, model-id check is static (D-10)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3 flagged for deeper research]: LLM-judge rubric design + bias mitigation + human-agreement metric is highest-uncertainty/highest-value — consider `--research-phase` at plan time.
- [Phase 0 open gap]: Exact Gemini model id unresolved (sources conflict) — pin against ai.google.dev at build time.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Public-ready | Rate limit / per-user token+spend quota / member-admin RBAC / Redis limiter (PUB-01..04) | v2 backlog | 2026-08-17 |
| Self-host | Migrate Supabase Cloud → self-host in Docker (HOST-01) | v2 backlog | 2026-08-17 |

## Session Continuity

Last session: 2026-08-17T09:36:33.449Z
Stopped at: Completed 00-04-PLAN.md
Resume file: None
