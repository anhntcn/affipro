# Project Research Summary

**Project:** Affipro - internal-first AI affiliate-content generator + quality-optimization loop
**Domain:** Adding Supabase auth/persistence + LLM-as-judge scoring loop to an existing React 19 + Vite 6 + Express + Gemini app
**Researched:** 2026-08-17
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone bolts five capabilities - Google login, per-user generation history, human + LLM-as-judge scoring, a prompt-optimization dashboard, and generate-time config - onto an existing one-shot Gemini content generator. The unifying goal is measurable quality improvement over time (average quality score rises), and every research file converges on the same conclusion: the real product is not the features individually but the **score-to-prompt_version-to-config join** that makes the optimization loop analyzable. The scope deliberately excludes rewriting the existing React/Vite/Express/Gemini core (no Next.js migration).

The recommended approach keeps the current modular monolith and adds exactly two load-bearing seams that preserve provider independence: a thin verifyUser(token) auth seam (Express verifies Supabase JWTs locally via jose + JWKS, using asymmetric signing keys) and a single db/client.ts module that owns the only Supabase connection. The SPA uses supabase-js for **Google OAuth only** - it never touches the database directly; all data flows through Express /api/* behind a Bearer JWT. The LLM-judge runs inline in /api/generate (no queue) behind an extraction seam, correct for internal scale. Persistence must capture an immutable snapshot of prompt body, model id, generation config, user config, and judge/rubric version from the very first generation - the single most important schema decision.

The dominant risks are security and signal integrity. Security: never decode-without-verify a JWT, never leak the service_role key to the client, and never create a table without enabling RLS in the same migration. Signal integrity: the optimization loop chases noise when the judge shares the generator model (self-preference/verbosity/position bias), so judge with a different model/config, use an analytic Vietnamese-tuned rubric, and calibrate against human votes with a visible agreement metric. Additionally, a cluster of known Phase-0 bugs (invalid model id, unguarded JSON.parse, no error boundary, hardcoded PORT) must be fixed and locked with CI tests before auth/DB churn regresses them, since the repo currently has zero tests.

## Key Findings

### Recommended Stack

Additive-only stack targeting a single Docker container + Supabase Cloud. All versions verified via npm view on 2026-08-17. See STACK.md for full detail.

**Core technologies:**
- @supabase/supabase-js 2.112.3 - SPA-side Google OAuth + token management ONLY (never .from() DB calls)
- jose 6.2.9 - server-side Supabase JWT verification in Express via createRemoteJWKSet + jwtVerify (asymmetric keys, zero calls back to Supabase)
- Supabase Postgres (Cloud) + Supabase CLI - SQL datastore for users/generations/scores with RLS-as-code migrations (low lock-in, self-hostable)
- @google/genai 2.17.1 - bump existing Gemini SDK; reused for both generation and inline judge with enforced responseSchema
- zod 3.x - validate /api bodies and guard JSON.parse of Gemini output
- express-rate-limit 8.6.2 - deferred to public phase; in-memory keyed on user id

**Version caution (MEDIUM):** Gemini model landscape is fast-moving - re-verify the exact model id at build time; gemini-2.5-flash is the safe default. Do NOT adopt v3 pre-releases of supabase-js or genai.

### Expected Features

Calibrated for internal team scale (a handful of trusted users), which turns several obvious SaaS features into anti-features. See FEATURES.md.

**Must have (table stakes / P1):**
- Google login (single provider, JWT verified server-side)
- Persist every generation with input/output/config/prompt_version/user_id
- Generate-time config (channel selection, tone, video length) - also an experiment axis
- Per-user history list + detail (with existing copy-to-clipboard)
- Human thumbs up/down per channel (binary, not 5-star)
- LLM-as-judge inline analytic scoring (hook/naturalness/CTA per channel, structured JSON)
- Optimization dashboard: score per criterion by prompt_version and config

**Should have (competitive / P2):**
- Per-channel, per-criterion scoring (biggest lever on judge usefulness)
- Human-vs-judge agreement view (guardrail against judge drift)
- Side-by-side prompt_version comparison + score delta
- Regenerate-with-adjusted-config (branch, never overwrite)
- Vietnamese-tuned rubric criteria (the van dich may moat)

**Defer (v2 / public-ready milestone, P3):**
- Rate limiting + per-user quota
- Member/admin RBAC
- Background worker/queue for the judge
- Full BI suite, auto-prompt-optimization, rich-text editor, collaborative comments

### Architecture Approach

Keep the existing Express BFF + Vite SPA modular monolith. Introduce a src/server/ tree with clean routes/services/repo boundaries, and isolate the two anti-lock-in seams as their own files. Express is the sole authorization gate (service-role connection scoped by user_id in code); RLS is enabled as defense-in-depth. The judge runs inline behind an extraction seam so it can later move to a worker with a routing change, not a rewrite. See ARCHITECTURE.md.

**Major components:**
1. SPA Auth (src/lib/auth.ts) - Google OAuth, session, getToken(); supabase-js Auth submodule only
2. verifyUser.ts (SEAM 1) - JWT to {userId,email,role} via jose+JWKS; role from app_metadata
3. db/client.ts (SEAM 2) - the only module holding the Supabase URL + service-role key
4. Generation service + inline judge service - HTTP-agnostic, testable, worker-extractable
5. Repo layer (profiles/generations/scores) + Postgres schema with RLS keyed on user_id

### Critical Pitfalls

1. **Decode-not-verify JWT** - verify signature via JWKS, assert issuer (/auth/v1 suffix) + audience; add a forged-token rejection test.
2. **service_role key leak / RLS bypass** - key server-only, never VITE_-prefixed; per-request user-JWT client for user data; grep the built bundle in CI.
3. **RLS off on public tables** - ENABLE ROW LEVEL SECURITY in the same migration as CREATE TABLE + owner policies; lint for rowsecurity=false.
4. **LLM-judge bias corrupts the loop** - judge with a different model/config, analytic Vietnamese rubric, length normalization, randomized pairwise order, and human-agreement calibration.
5. **Un-analyzable versioning** - snapshot the full resolved prompt body + model id + generationConfig + user config + judge/rubric version per row; never mutate a version in place.
6. **Unguarded JSON.parse under responseSchema** - schema does NOT guarantee parseable JSON; try/catch, check finishReason, Zod-validate, add React error boundary.

## Implications for Roadmap

Research strongly and consistently endorses the PROJECT.md phase sequence (Phase 0-6). Dependencies dictate a strict-ish order; the two seams must land before any authed data feature.

### Phase 0: Fix-to-run + CI net
**Rationale:** Auth/DB must sit on a working, test-locked base; known bugs will regress under later server.ts churn (zero tests today).
**Delivers:** Valid/allowlisted Gemini model id, guarded JSON.parse + finishReason check + Zod validation, React error boundary, PORT from env, .env.example, boot-time env validation, CI with happy/malformed integration tests.
**Avoids:** Pitfalls 7 & 8 (unguarded parse, Phase-0 regression). Also lands input-length cap + usageMetadata token logging early.

### Phase 1: Auth + Google OAuth (SEAM 1)
**Rationale:** Foundation for every per-user feature; establishes req.user.
**Delivers:** SPA auth.ts (OAuth only), verifyUser (jose+JWKS), requireUser middleware, login UI, store apiFetch wrapper, profiles upsert on first login.
**Uses:** @supabase/supabase-js, jose. **Avoids:** Pitfalls 1 & 2 (forged-token test, service_role discipline).

### Phase 2: Persistence + generate config (SEAM 2 + schema)
**Rationale:** The optimization loop substrate; versioning/config must be captured before any scoring.
**Delivers:** db/client.ts, supabase/migrations (profiles/generations/scores + RLS), immutable prompt/config snapshot on every generation, generate-time config UI (channel/tone/length), history persistence.
**Avoids:** Pitfalls 3 & 5 (RLS-in-migration, full-snapshot versioning).

### Phase 3: Scoring loop - human votes + inline LLM-judge
**Rationale:** Core value driver; requires persisted generations to score.
**Delivers:** POST /api/scores + per-channel thumbs UI; services/judge.ts inline analytic Vietnamese rubric with structured JSON; judge_model + rubric_version stored per score.
**Avoids:** Pitfall 4 (judge bias) - different model, human-agreement tracking, length normalization.

### Phase 4: Optimization dashboard
**Rationale:** Closes the loop; needs score data from Phase 3.
**Delivers:** Aggregate score per criterion by prompt_version and config, trend line, and human-vs-judge agreement view (P2).

### Phase 5: Docker packaging + Supabase Cloud
**Rationale:** Finalize last so all env vars are known.
**Delivers:** Single-container image serving built SPA + /api; runtime env (no baked secrets), fail-fast env validation, registered OAuth redirect URLs.

### Phase 6: Public-ready (deferred)
**Rationale:** Premature internally; PROJECT.md sequences here.
**Delivers:** Per-user token/spend/RPM/concurrency quota (not just request-count), member/admin RBAC via app_metadata, Redis-backed rate limiter, optional judge worker extraction.

### Phase Ordering Rationale

- Everything downstream requires auth + the persistence schema first; the two seams (Phase 1 auth, Phase 2 DB) are hard prerequisites for any authed data feature.
- prompt_version + full config snapshot must exist before scoring (Phase 3) or the dashboard (Phase 4) - retrofitting onto un-tagged rows is lossy.
- Fixing runnable bugs + CI first (Phase 0) prevents known defects regressing when Phases 1-5 rewrite server.ts.
- Human votes and the LLM-judge share the scores table and are largely parallelizable within Phase 3; features after Phase 2 pair up (config+history, human+judge) for parallel execution.

### Research Flags

Phases likely needing deeper research during planning (--research-phase):
- **Phase 3 (Scoring):** LLM-judge rubric design + bias mitigation + human-agreement metric is the highest-uncertainty, highest-value area; Vietnamese-tuned rubric edge cases need care.
- **Phase 6 (Public-ready):** Token/spend quota architecture and Redis-backed limiter differ materially from the internal in-memory default.

Phases with standard patterns (can skip research-phase):
- **Phase 1 (Auth):** jose+JWKS + Supabase OAuth is well-documented; patterns already specified in ARCHITECTURE.md.
- **Phase 2 (Persistence):** Standard Postgres + RLS migrations; schema shape already derived.
- **Phase 4 (Dashboard):** Straightforward aggregate queries over an already-designed schema.
- **Phase 5 (Docker):** Standard single-container packaging.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions verified via npm view; JWT/Gemini approaches from official docs; Gemini model id is fast-moving (re-verify at build). |
| Features | MEDIUM | LLM-tooling norms cross-checked across vendors; product-specific scoping is opinionated inference from PROJECT.md + codebase. |
| Architecture | MEDIUM-HIGH | Existing architecture read directly; Supabase mechanics cross-checked against official docs. |
| Pitfalls | MEDIUM (HIGH for codebase bugs) | Web-corroborated against Supabase docs, Google AI forum, LLM-judge papers; Phase-0 bugs verified against codebase map. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Exact Gemini model id** - sources conflict on whether gemini-3.7-flash is valid; pin against ai.google.dev/gemini-api/docs/models at Phase 0 build time and enforce via allowlist.
- **Judge model choice** - a distinct judge model is recommended but not fixed; decide in Phase 3 (or document the shared-model config explicitly) and never report a shared-model score as quality.
- **jose ESM interop with esbuild** - verify the existing dist/server.cjs bundling handles the ESM-native lib; resolve in Phase 1.
- **Migration ownership** - if Drizzle is adopted, pick ONE migration owner (Supabase CLI vs drizzle-kit); do not run two systems.
- **Self-host auth-key setup** - the env-var swap migration path is MEDIUM confidence; re-verify exact key setup only at actual migration time.

## Sources

### Primary (HIGH confidence)
- Supabase docs - JWTs, signing keys, getClaims/getUser, RLS, securing-data, custom-claims RBAC, self-hosting
- Google AI docs - structured output, GenerateContentConfig, models landscape
- npm registry (npm view, 2026-08-17) - all pinned versions
- .planning/codebase/CONCERNS.md + .planning/PROJECT.md - known bugs + phase decisions

### Secondary (MEDIUM confidence)
- arXiv - self-preference bias (2410.21819), position bias (2406.07791) in LLM-as-judge
- LLM-as-judge / rubric best-practice writeups (Galtea, W&B, Microsoft DS+AI, Langfuse)
- Prompt-versioning + tooling comparisons (Respan, PromptLayer, Paradigma)
- Rate-limiting for LLM apps (Portkey, MetaCTO); Gemini structured-output failure reports (GitHub #1039, Google AI forum)

### Tertiary (LOW confidence)
- Gemini model-name specifics (fast-moving - validate at build)
- Supabase Cloud-to-self-host migration guides (Meetrix, Supascale - re-verify at migration time)

---
*Research completed: 2026-08-17*
*Ready for roadmap: yes*
