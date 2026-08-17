# Stack Research

**Domain:** Internal-first affiliate-content-generation SaaS — adding Supabase auth/persistence + LLM-judge scoring loop to an existing React 19 + Vite 6 + Express + Gemini app
**Researched:** 2026-08-17
**Confidence:** MEDIUM-HIGH (versions verified via `npm view`; JWT + Gemini approaches verified against official docs; model-name landscape is fast-moving — flagged inline)

> Scope note: This researches ONLY the additions — Supabase auth/DB accessed through Express, generation history, scoring/optimization loop, generate-time config, Docker packaging, and rate limiting. The existing React/Vite/Express/Gemini generation core is NOT re-researched and is kept as-is per project constraints (no rewrite to Next.js).

---

## Recommended Stack

### Core Technologies (the additions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | `2.112.3` | Supabase client — used in the **SPA only** for `signInWithOAuth` (Google) + session/token management | Official SDK; handles the PKCE OAuth dance and token refresh so you never build a password/session system. Per anti-lock-in rule, SPA uses it ONLY for auth (get a JWT), never for DB reads. |
| `jose` | `6.2.9` | **Server-side JWT verification in Express** | Official Supabase docs (2026) recommend `jose` for verifying Supabase JWTs in a non-Supabase backend: `createRemoteJWKSet(<jwks_url>)` + `jwtVerify`. New Supabase projects default to **asymmetric signing keys (ES256/RS256)**, so Express verifies locally against the JWKS endpoint with zero calls back to Supabase — this is exactly the thin `verifyUser(token)` seam the project wants. |
| Supabase Postgres (Cloud) | managed | Primary datastore for users, generation history, prompt_version/config, votes, judge scores | SQL fits the scoring/analytics/dashboard requirement far better than a document store; RLS + Google OAuth built-in; self-hostable → low lock-in (matches Key Decision in PROJECT.md). |
| Supabase CLI | latest (`supabase`) | Versioned SQL migrations + local dev + RLS-as-code (`supabase/migrations/*.sql`) | Native to the platform, keeps schema **and** RLS policies in plain SQL under version control. Lock-in-neutral: the migrations are standard Postgres SQL you can run anywhere if you leave Supabase. |
| `@google/genai` | `2.17.1` | Gemini SDK (already in project at `^2.4.0` — **bump to 2.17.1**) | Same SDK already used; upgrade gets current model support + stable `responseSchema`. Reused for both content generation and the LLM-as-judge call. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express-rate-limit` | `8.6.2` | Per-user rate limiting on `/api/*` | Internal + first public phase. In-memory `MemoryStore` + `keyGenerator` returning the authenticated user id (fallback to `ipKeyGenerator`). Fits the single-container deployment with zero infra. |
| `pg` | `8.23.0` | Postgres driver | If you talk to Postgres with raw SQL from Express (simplest, no ORM). |
| `postgres` (postgres-js) | `3.4.9` | Alternative Postgres driver | Preferred driver if you adopt Drizzle (below); faster, better TS ergonomics than `pg`. |
| `drizzle-orm` | `0.45.2` | Typed query builder / lightweight ORM | **Optional.** Use if you want type-safe queries + typed rows in Express (helpful given TS codebase and analytics queries). Pair with `postgres` driver. |
| `zod` | latest 3.x | Runtime validation of `/api` request bodies + Gemini JSON output shape | Validate generate-time config (video length enum, tone, channel) and guard `JSON.parse` of Gemini output (fixes a known CONCERNS.md issue). Can also derive the Gemini `responseSchema`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `drizzle-kit` | `0.31.10` | Migration generation for Drizzle | Only if Drizzle is adopted. Otherwise Supabase CLI owns migrations — **do not run two migration systems**. |
| Supabase CLI (local) | Local Postgres + auth emulation, `supabase db diff`, `supabase migration new` | Enables local dev without hitting Cloud; keeps RLS in SQL. |
| Docker (single image) | Package the Express app (serving built SPA + `/api`) as one container | Supabase stays Cloud (managed). Container needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWKS_URL` (or derive), `GEMINI_API_KEY`, and DB connection string as env. |

## Installation

```bash
# Server-side additions (Express)
npm install jose@6 pg@8 express-rate-limit@8 zod

# Client-side (SPA auth only)
npm install @supabase/supabase-js@2

# Upgrade existing Gemini SDK
npm install @google/genai@2

# Optional: typed DB access instead of raw pg
npm install drizzle-orm@0 postgres@3
npm install -D drizzle-kit@0

# Migrations + local dev (installed as CLI, not a dep)
# via npm: npm install -D supabase   (or brew/scoop)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `jose` for JWT verify in Express | Supabase `supabase.auth.getUser(token)` | Only if you MUST have the freshest user record (network call to Supabase per request) or your project still uses legacy HS256 shared-secret keys. For asymmetric keys, `jose` + JWKS is faster and keeps Express independent of the Supabase SDK. |
| `jose` | `jsonwebtoken` + manual JWKS | `jose` is the officially-referenced lib, is ESM-native, and handles JWKS caching/rotation cleanly. `jsonwebtoken` needs `jwks-rsa` glue and is not what Supabase docs show. |
| Supabase CLI migrations (SQL) | Drizzle Kit migrations (code-first) | Choose Drizzle Kit if the team strongly prefers TS schema-as-source-of-truth and typed queries, and is willing to manage RLS policies as separate SQL. Do not mix both. |
| `express-rate-limit` (in-memory) | `rate-limiter-flexible@11.2.0` (Redis-backed) | When rate limiting becomes a **product surface** — real per-user quotas, paid tiers, login-defense, or when you scale beyond one container and need shared limit state. Plan this as the public-phase upgrade. |
| Raw `pg` | `drizzle-orm` | Raw `pg` is fine and dependency-light for the internal phase; add Drizzle when analytics/dashboard queries grow and you want type safety. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| SPA calling Supabase DB directly (`supabase.from('...').select()`) | Violates the project's anti-lock-in rule; couples the client to Supabase and scatters auth/RLS logic; makes migrating off Supabase a full client rewrite | SPA gets a JWT only; all DB access goes through Express behind `verifyUser(token)` |
| `supabase.auth.getUser()` on **every** protected Express request | Adds a network round-trip to Supabase per API call and reintroduces vendor coupling in the hot path | Local `jose` JWKS verification; reserve `getUser()` for rare freshness-critical operations |
| Legacy HS256 shared JWT secret verification | Requires distributing the JWT secret to Express and can't verify locally without it; being phased out in favor of asymmetric keys | Enable/keep **asymmetric signing keys** (default for new Supabase projects) + JWKS |
| Storing generations WITHOUT `prompt_version` + `config` | Without versioning you cannot run the optimization loop or the score-vs-version dashboard — this is a rewrite-class mistake if deferred | Persist `prompt_version`, full generate config, model id, and judge_model with every row from day one |
| A message queue / worker for LLM-as-judge now | Over-engineering at internal scale; the project explicitly chose inline judging | Run the judge as a second inline Gemini call in `/api/generate`; extract to a worker only if latency/cost forces it |
| `gemini-2.0-flash` (or unverified model strings) | `gemini-2.0-flash` is shut down; hardcoded/guessed model names cause runtime 400s (the existing CONCERNS.md symptom) | See "Gemini model + structured output" below — use a current stable model and enforce `responseSchema` |
| `express-rate-limit` MemoryStore in a multi-instance deploy | In-memory limits aren't shared across containers → limits leak | Fine for single container now; switch to `rate-limiter-flexible` + Redis when scaling out |

## Gemini model + structured output (2026)

Verified against `ai.google.dev` docs and the `@google/genai` `GenerateContentConfig` reference.

**API shape (current, stable):**
```ts
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const res = await ai.models.generateContent({
  model: "gemini-2.5-flash",          // see model note below
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: schemaObject,       // enforce the 4-channel bundle shape
  },
});
```

**Model note (IMPORTANT, MEDIUM confidence — verify at build time):**
- Current stable general models as of 2026-08 include `gemini-2.5-flash`, `gemini-2.5-pro`, and newer `gemini-3.x-flash` variants; `gemini-2.0-flash` is **shut down**.
- The existing code's `gemini-3.7-flash` appears in current Google model listings as a **valid stable model** in 2026 — contrary to the codebase CONCERNS.md note that flagged it as invalid. The likely real bug is the missing `responseSchema`/parse guard, not the model string alone. **Action for the fixing phase:** verify the exact model id against `ai.google.dev/gemini-api/docs/models` at implementation time and pin it; for cost, `gemini-2.5-flash` is the safe price-performance default for both generation and the judge.
- Enforce `responseSchema` + validate with `zod` before `JSON.parse` trust — this directly fixes the "no schema/guard" concern.

**LLM-as-judge:** second inline `generateContent` call using a cheap model (`gemini-2.5-flash`) with a `responseSchema` that forces per-channel numeric scores + short rationale. Prompt with an explicit rubric, low temperature, ask for rationale-before-score, and persist `judge_model` + `prompt_version` + `config` alongside the score.

## Stack Patterns by Variant

**If staying single-container internal (now):**
- `express-rate-limit` in-memory, raw `pg` (or Drizzle if you want types), Supabase CLI migrations, inline judge.
- Because: minimal infra, fast to ship, matches modular-monolith decision.

**If/when going public with real quotas + multiple instances:**
- Swap to `rate-limiter-flexible` + Redis; consider extracting the judge to a background job; add `admin`/`member` roles via Supabase custom claims (RBAC) surfaced in the JWT.
- Because: shared rate state and cost isolation become necessary at that scale.

**If team wants full type-safety across the DB layer:**
- Adopt `drizzle-orm` + `postgres` driver + `drizzle-kit`, and keep RLS policies as SQL migrations. Pick ONE migration owner.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@supabase/supabase-js@2.112.3` | Node 18+ / modern browsers | `next: 3.0.0-next.x` exists — do NOT use the v3 pre-release for production yet. |
| `jose@6.2.9` | Node 18+ (ESM) | ESM-native; ensure the Express build (esbuild → `dist/server.cjs`) handles ESM interop or import dynamically. Verify against the current esbuild bundling in this repo. |
| `@google/genai@2.17.1` | current project uses `^2.4.0` | Minor bump within v2; `next: 3.0.0-next.x` exists — stay on v2 stable. |
| `express-rate-limit@8.6.2` | Express `^4.21.2` (project's version) | v8 supports Express 4 and 5; `keyGenerator`/`ipKeyGenerator` API used here is current. |
| `drizzle-orm@0.45.2` | `drizzle-kit@0.31.10`, `postgres@3.4.9` | Keep drizzle-orm and drizzle-kit versions in step. |

## Sources

- https://supabase.com/docs/guides/auth/jwts — verified: 2026 recommends `jose` + JWKS for non-Supabase backends; asymmetric keys default (HIGH)
- https://supabase.com/docs/reference/javascript/auth-getclaims — `getClaims` vs `getUser` semantics (HIGH)
- https://supabase.com/docs/guides/auth/signing-keys — asymmetric signing keys default for new projects (HIGH)
- https://ai.google.dev/gemini-api/docs/structured-output + https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html — `generateContent` + `responseMimeType`/`responseSchema` shape (HIGH)
- https://ai.google.dev/gemini-api/docs/models — current model landscape; `gemini-2.0-flash` shut down (MEDIUM — fast-moving, re-verify at build)
- npm registry via `npm view` (2026-08-17) — pinned versions: @supabase/supabase-js 2.112.3, jose 6.2.9, @google/genai 2.17.1, express-rate-limit 8.6.2, rate-limiter-flexible 11.2.0, drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0, postgres 3.4.9, node-pg-migrate 9.0.0 (HIGH)
- https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac — RBAC via custom claims for member/admin (MEDIUM)

---
*Stack research for: Supabase auth/persistence + LLM-judge scoring additions to Express+Vite+Gemini app*
*Researched: 2026-08-17*
