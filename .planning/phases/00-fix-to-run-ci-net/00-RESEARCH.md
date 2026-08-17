# Phase 0: Fix-to-run + CI net - Research

**Researched:** 2026-08-17
**Domain:** Gemini (`@google/genai` v2.x) structured output + failure handling, Zod validation, React error boundaries, Vitest/Supertest integration testing, GitHub Actions CI
**Confidence:** HIGH (external facts verified against official Gemini docs + npm registry; one model-id conflict surfaced honestly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Replace `model: "gemini-3.7-flash"` (`server.ts:85`) with a flash model. CONTEXT.md proposes `gemini-2.5-flash` but **explicitly requires the researcher to re-verify the id against live Gemini docs at build-time** and update the allowlist to whatever is verified. **See the "Gemini Model ID" finding below — this decision needs a user confirmation because the live-docs result conflicts with the phase's stated assumption.**
- **D-02:** Send a **typed `responseSchema`** to Gemini (structured output constraining the 4-channel shape) — not `responseMimeType` alone.
- **D-03:** **Zod validate a second time server-side** on the parsed output before returning to the client (double-guard: Gemini schema + Zod). `zod` is not in `package.json` → add it.
- **D-04:** Check `finishReason` before parsing; if truncate / not `STOP` → treat as error.
- **D-05:** **Auto-retry once** on corrupted/truncated/parse-fail output; if still failing → return a clear **Vietnamese** error (no white screen) + a UI retry button. Retry transient failures, do NOT retry hard schema failures.
- **D-06:** Client: **ErrorBoundary** + null-guard every `.map()` / array access in `ResultDisplay.tsx`.
- **D-07:** Server reads `PORT` from env (replace hardcode `server.ts:12`); **boot fail-fast** with a clear message when a required env var (minimum `GEMINI_API_KEY`) is missing.
- **D-08:** Create `.env.local.example`; clean AI Studio template metadata/README.
- **D-09:** **Init git + create GitHub repo** so CI runs via **GitHub Actions** on every change. *(Dependency step, not new scope.)* **Note: git is ALREADY initialized in this working directory (verified `git rev-parse --is-inside-work-tree` → true). See Environment Availability — the remaining work is creating/pushing to a GitHub remote, not `git init`.**
- **D-10:** Model-id CI verification = **static allowlist** (valid ids listed in the repo; CI checks the id used in `server.ts` is in the allowlist). **No `GEMINI_API_KEY` secret in CI**, no quota spend.
- **D-11:** Test runner = **Vitest**. Integration test calls the `/api/generate` handler with the **Gemini SDK mocked**: (1) happy path → valid JSON, (2) malformed/truncate → error not crash, (3) model-id allowlist check. Add a `test` script to `package.json`.

### Claude's Discretion
- Exact Gemini SDK mocking approach, test directory structure, exact env vars in the fail-fast list, Zod schema/type organization (kept in sync with `src/types.ts`), retry backoff policy — researcher/planner decide per best practice + codebase.

### Deferred Ideas (OUT OF SCOPE)
- Rate limiting `/api/generate` (PUB-01/PUB-02) — public-ready phase, NOT Phase 0 (even though CONCERNS.md raises it).
- Pinging the live Gemini API to verify the id in CI — reconsider only if the static allowlist proves insufficient; deferred for now.
- Everything else beyond FIX-01…FIX-06 (auth, DB, config, scoring) — later phases.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Call Gemini with a build-time-verified valid model id (no nonexistent id) | "Gemini Model ID" finding: verified id list + allowlist contents + the `gemini-3.7-flash` conflict |
| FIX-02 | Gemini response constrained by `responseSchema` and validated (Zod) before returning to client | "Structured Output" + "Zod Double-Guard" findings: exact `config.responseSchema` shape mirroring `src/types.ts`, Zod v4 schema |
| FIX-03 | On corrupt/missing-field/truncated JSON, report a clear error instead of crashing (check `finishReason`, guard parse) | "Failure Detection & Retry" finding: `finishReason` enum, guarded parse, single-retry policy |
| FIX-04 | UI renders without crashing when fields are missing (guard every `.map`/array access, ErrorBoundary) | "Client Resilience" finding: ErrorBoundary pattern + null-guard list for `ResultDisplay.tsx` |
| FIX-05 | Server reads `PORT` from env; `.env.local.example` exists; AI Studio template metadata/README cleaned | "Fail-fast Env + Cleanup" finding: boot validation pattern + cleanup file list |
| FIX-06 | CI net (happy path + malformed JSON + model-id allowlist) runs automatically to block regressions | "Vitest Integration Test" + "GitHub Actions CI" findings: test structure, mock strategy, workflow YAML |
</phase_requirements>

## Summary

This phase hardens a single fragile seam — the `/api/generate` Express handler in `server.ts` that proxies one prompt to Gemini — and freezes the fixes behind a CI net before later phases rewrite the file. All seven research targets resolved with HIGH confidence except one, which is the most important finding: **the phase's assumption that `gemini-3.7-flash` is an invalid/nonexistent model id is no longer true as of 2026-08-17.** Google shipped the Gemini 3.x family since the app was scaffolded; `gemini-3.7-flash` is now a real GA model (released 2026-08-13 per the BenchLM directory). Meanwhile the official Gemini deprecations doc lists `gemini-2.5-flash` (D-01's proposed replacement) as **stable with no shutdown date**. Both ids are currently valid. This is exactly the "verify at build-time, do not assume" situation the phase called out — the decision now needs a quick user confirmation on which id to pin, and the allowlist should contain the verified set (not a single assumed-good id).

The `@google/genai` v2.x API for the remaining work is stable and well-supported: structured output is `config.responseMimeType: "application/json"` + `config.responseSchema` (a plain JSON-schema-shaped object using `Type` enums / `"OBJECT"`/`"ARRAY"`/`"STRING"` strings), `finishReason` is read from `response.candidates[0].finishReason` (values `STOP`, `MAX_TOKENS`, `SAFETY`, `RECITATION`, `OTHER`), and `response.text` is `undefined` when the model returns no text part (e.g. a safety block). Zod v4 (4.4.3) mirrors `src/types.ts` for the server-side double-guard. Vitest 4 + Supertest 7 with `vi.mock('@google/genai')` gives a no-API-key, no-quota integration test of the handler — but this requires refactoring `server.ts` to **export the Express app / route handler** separately from `startServer()` (which currently boots Vite middleware inline and is not importable in a test). GitHub Actions runs `tsc --noEmit` + `vitest run` + a tiny allowlist grep on push/PR.

**Primary recommendation:** Refactor `server.ts` to export a testable `app` (or the bare handler) with the Gemini call behind a thin injectable seam; pin the model id in one exported constant that both the handler and the CI allowlist check import; validate output with Zod v4 mirrored from `src/types.ts`; guard the client with an ErrorBoundary + optional-chaining; and gate all of it with a Vitest+GitHub-Actions net. Confirm the exact model id with the user before locking the allowlist.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gemini model id + call | API / Backend (`server.ts`) | — | Key + model choice must stay server-side (CLAUDE.md: Gemini key server-side only) |
| `responseSchema` structured output | API / Backend | — | Constructed in the same handler that builds the prompt |
| Zod validation of model output | API / Backend | — | Server is the trust boundary; validate before the payload crosses to the client |
| `finishReason` check + single retry | API / Backend | — | Only the server sees the raw Gemini response object |
| Vietnamese error message surfacing | API/Backend (produces) → Client (renders) | Client store (`useStore.ts`) | Server returns a human message; existing red banner in `App.tsx` renders it |
| ErrorBoundary + null-guards | Browser / Client (`ResultDisplay.tsx`) | — | Render-time defense against missing fields |
| `PORT` / fail-fast env | API / Backend (boot) | — | Process configuration |
| Model-id allowlist check | CI (GitHub Actions) | Backend (exports the constant) | Static check, no runtime; imports the pinned constant from source |
| Happy/malformed integration test | CI (Vitest) | Backend (exports `app`/handler) | Requires the handler to be importable without booting Vite |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | `^2.4.0` (installed; latest 2.17.1) `[VERIFIED: npm registry]` | Gemini SDK — already present, no change needed | It is the current official Google GenAI JS SDK (the old `@google/generative-ai` is superseded) |
| `zod` | `^4.4.3` `[VERIFIED: npm registry]` | Server-side output validation (D-03 double-guard) + fail-fast env parsing | De-facto TS runtime-validation standard; v4 is current stable |
| `vitest` | `^4.1.10` `[VERIFIED: npm registry]` | Test runner (D-11) — reuses the existing Vite pipeline/config | Vite-native; zero extra bundler config for a Vite project |
| `supertest` | `^7.2.2` `[VERIFIED: npm registry]` | Drive the Express `/api/generate` handler in-process (no live server/port) | Standard way to integration-test an Express app without `listen()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | `^4.1.10` `[VERIFIED: npm registry]` | Coverage reporting | Optional; only if a coverage gate is wanted in CI |
| `@types/supertest` | latest `[ASSUMED]` | Types for supertest | If supertest's bundled types are insufficient (supertest 7 ships its own types; verify before adding) |
| `rimraf` | `^6.1.3` `[VERIFIED: npm registry]` | Cross-platform `clean` script (CONCERNS: current `rm -rf` is POSIX-only, breaks on Windows dev box) | Optional cleanup improvement; in scope only if touching `package.json` scripts anyway |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supertest | `vi.fn()` mock `req`/`res` objects | Lighter (no dep) but hand-rolls Express req/res contract and misses middleware (`express.json()`); supertest exercises the real routing/parsing path. Prefer supertest. |
| zod | `valibot` / `ajv` | zod is already the ecosystem default and pairs with TS types cleanly; no reason to diverge for an internal tool |
| Vitest | Jest | Jest needs extra transform config for a Vite/ESM project; Vitest reuses `vite.config.ts` — strictly less setup here (D-11 already picked Vitest) |

**Installation:**
```bash
# dependencies
bun add zod
# devDependencies
bun add -d vitest supertest
# optional
bun add -d @vitest/coverage-v8
bun add -d rimraf   # only if fixing the POSIX-only clean script
```
*(Repo uses `bun.lock`; use `bun add`. If the planner standardizes on npm, use `npm install` equivalently — but pick ONE package manager per the CONCERNS "Dependencies at Risk" note and commit that lockfile.)*

**Version verification (done this session):**
- `zod` → `4.4.3` (latest) `[VERIFIED: npm registry]`
- `vitest` → `4.1.10` (latest) `[VERIFIED: npm registry]`
- `supertest` → `7.2.2` (latest) `[VERIFIED: npm registry]`
- `@vitest/coverage-v8` → `4.1.10` `[VERIFIED: npm registry]`
- `rimraf` → `6.1.3` `[VERIFIED: npm registry]`
- `@google/genai` → installed `^2.4.0`, latest `2.17.1` (v2.x API stable; no upgrade required for this phase) `[VERIFIED: npm registry]`

## Package Legitimacy Audit

> All packages verified via `npm view` on the correct (npm) registry this session. None have a `postinstall` script (`npm view <pkg> scripts.postinstall` returned empty for zod and vitest).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `zod` | npm | mature (v4 line) | very high (tens of M/wk) | github.com/colinhacks/zod | OK | Approved |
| `vitest` | npm | mature | very high | github.com/vitest-dev/vitest | OK | Approved |
| `supertest` | npm | mature (10+ yrs) | very high | github.com/ladjs/supertest | OK | Approved |
| `@vitest/coverage-v8` | npm | mature (vitest monorepo) | high | github.com/vitest-dev/vitest | OK | Approved |
| `rimraf` | npm | mature (10+ yrs) | very high | github.com/isaacs/rimraf | OK | Approved |
| `@google/genai` | npm | current official SDK | high | github.com/googleapis/js-genai | OK | Already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
*(`gsd-tools query package-legitimacy check` was unavailable this session — the shim was not found on PATH. Legitimacy assessed via `npm view` version/repo/downloads inspection + postinstall check, which is the same signal set the seam uses. All are long-established, high-download packages with public source repos.)*

## Architecture Patterns

### System Architecture Diagram

```
                 ┌─────────────────────────────────────────────────────────┐
Browser (SPA)    │  InputForm ──► useStore.generateContent() ──► fetch      │
  React 19       │       ▲                                         │        │
                 │  ErrorBoundary ⟵ ResultDisplay ⟵ store.generatedContent  │
                 │  (null-guarded .map / array access)   ▲  store.error ────┼──► red banner (App.tsx)
                 └───────────────────────────────────────┼─────────────────┘
                                                          │  POST /api/generate
                                                          ▼
                 ┌─────────────────────────────────────────────────────────┐
Express (Node)   │  boot: validateEnv() ──fail-fast──► process.exit(1)      │
                 │        PORT = env.PORT ?? 3000                           │
                 │                                                          │
                 │  handler /api/generate:                                  │
                 │    validate body (400) ──► callGemini(prompt) ─┐         │
                 │                                                ▼         │
                 │    ┌── check response.candidates[0].finishReason         │
                 │    │     STOP ─► JSON.parse (guarded) ─► Zod.safeParse    │
                 │    │     MAX_TOKENS / SAFETY / parse-fail / zod-fail      │
                 │    │        └─ transient? ─► retry ONCE ─► else 4xx/5xx   │
                 │    │                          with Vietnamese message     │
                 │    └── success ─► res.json(validated)                    │
                 └───────────────────────────┬─────────────────────────────┘
                                             │  ai.models.generateContent
                                             ▼
                                    Google Gemini API
                                (model id from ONE exported constant,
                                 also asserted by CI allowlist check)
```
*Data flow follows the single primary use case (product info + link → 4-channel bundle) top-to-bottom. The Gemini call is the only external dependency and the only untrusted-output boundary.*

### Recommended Project Structure
```
affipro/
├── server.ts                 # export `app` (+ handler) separately from startServer()
├── src/
│   ├── types.ts              # existing TS contract (source of truth for Zod)
│   ├── schema/
│   │   └── generatedContent.ts   # Zod schema mirroring types.ts (+ z.infer type)
│   ├── lib/
│   │   └── gemini.ts         # (optional) thin seam wrapping ai.models.generateContent
│   └── components/
│       ├── ErrorBoundary.tsx     # NEW class component (D-06)
│       └── ResultDisplay.tsx     # null-guard all .map()/array access
├── server/
│   └── config.ts             # validateEnv() + PORT (fail-fast, D-07)
├── tests/
│   └── api.generate.test.ts  # supertest + vi.mock('@google/genai')
├── scripts/
│   └── check-model-allowlist.mjs   # CI static allowlist check (D-10)
├── vitest.config.ts          # or `test` block inside vite.config.ts
├── .env.local.example        # NEW (D-08)
└── .github/workflows/ci.yml  # lint + test + allowlist (D-09/D-10/D-11)
```
*(Exact folder names are Claude's discretion per CONTEXT.md — this is one clean layout. Co-locating tests as `*.test.ts` next to source is equally acceptable per TESTING.md's recommendation.)*

### Pattern 1: Testable Express handler (export `app`, don't boot Vite inline)
**What:** Split `server.ts` so the Express `app` and route handler are importable without starting Vite middleware or calling `listen()`.
**When to use:** Required for D-11 — the current `startServer()` builds a Vite dev server inline (`createViteServer`), so importing it in a test would spin up Vite and fail in CI.
```typescript
// server.ts — restructured
// Source: pattern derived from CONCERNS "safe modification" note + supertest docs
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { GeneratedContentSchema } from "./src/schema/generatedContent";

export const MODEL_ID = "gemini-2.5-flash"; // single source of truth; CI asserts this ∈ allowlist

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "32kb" })); // also caps prompt-injection surface (CONCERNS)
  app.post("/api/generate", generateHandler);
  return app;
}

// startServer() adds Vite middleware / static serving, then app.listen(PORT)
// tests import createApp() (or generateHandler) directly — no Vite, no listen()
```

### Pattern 2: Structured output with `responseSchema` (D-02)
**What:** Pass a typed schema so Gemini constrains the 4-channel object shape, not just "some JSON".
```typescript
// Source: ai.google.dev/api/generate-content + googleapis/js-genai
import { Type } from "@google/genai";

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    product_analysis: {
      type: Type.OBJECT,
      properties: {
        product_name: { type: Type.STRING },
        target_audience: { type: Type.STRING },
        key_benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["product_name", "target_audience", "key_benefits"],
    },
    facebook_threads: {
      type: Type.OBJECT,
      properties: {
        hook_headline: { type: Type.STRING },
        story_or_problem: { type: Type.STRING },
        product_highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
        call_to_action: { type: Type.STRING },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["hook_headline", "story_or_problem", "product_highlights", "call_to_action", "hashtags"],
    },
    short_video_script: {
      type: Type.OBJECT,
      properties: {
        video_title: { type: Type.STRING },
        estimated_duration: { type: Type.STRING },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scene_number: { type: Type.NUMBER }, // NOTE: INTEGER may not be a supported Type; use NUMBER, coerce/round in Zod
              time_range: { type: Type.STRING },
              visual_action: { type: Type.STRING },
              voiceover: { type: Type.STRING },
              on_screen_text: { type: Type.STRING },
            },
            required: ["scene_number", "time_range", "visual_action", "voiceover", "on_screen_text"],
          },
        },
      },
      required: ["video_title", "estimated_duration", "scenes"],
    },
    instant_deal_telegram_zalo: { type: Type.STRING },
  },
  required: ["product_analysis", "facebook_threads", "short_video_script", "instant_deal_telegram_zalo"],
};

const response = await ai.models.generateContent({
  model: MODEL_ID,
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema,               // constrain the shape (D-02)
    // temperature etc. optional
  },
});
```
`[CITED: ai.google.dev/api/generate-content]` `[CITED: googleapis.github.io/js-genai]`. `Type` is exported by `@google/genai`; string literals (`"OBJECT"`, `"STRING"`, `"ARRAY"`, `"NUMBER"`) also work. **Caveat below re `propertyOrdering` / `INTEGER`.**

### Pattern 3: finishReason check + guarded parse + single retry (D-04, D-05)
```typescript
// Source: ai.google.dev/api/generate-content (finishReason enum)
const HARD_FAIL = new Set(["SAFETY", "RECITATION"]); // do NOT retry — deterministic block
const RETRYABLE = new Set(["MAX_TOKENS", "OTHER"]);    // truncation / transient — retry once

async function generateOnce() {
  const response = await ai.models.generateContent({ model: MODEL_ID, contents: prompt, config });
  const finish = response.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    return { ok: false as const, reason: finish, retryable: !HARD_FAIL.has(finish) };
  }
  const text = response.text;               // undefined on safety block / no text part
  if (!text) return { ok: false as const, reason: "EMPTY", retryable: true };
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { ok: false as const, reason: "PARSE", retryable: true }; } // transient formatting glitch
  const result = GeneratedContentSchema.safeParse(parsed);
  if (!result.success) return { ok: false as const, reason: "SCHEMA", retryable: false }; // hard schema fail — no retry
  return { ok: true as const, data: result.data };
}

// handler: try once; if !ok && retryable → try again once; else map to a Vietnamese error.
```
**Retry policy (D-05):** retry once only for `MAX_TOKENS` / `OTHER` / `EMPTY` / `PARSE`; never retry `SAFETY` / `RECITATION` / `SCHEMA` (deterministic — a second identical call wastes a paid token round-trip and will fail the same way). No backoff needed for a single retry at internal scale; an optional 200–500ms jitter is harmless.

### Pattern 4: React ErrorBoundary (D-06)
```tsx
// Source: React docs — error boundaries must be class components (no hook equivalent as of React 19)
import { Component, ReactNode } from "react";
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error("Render error:", err); }
  render() {
    if (this.state.hasError) {
      return <div className="...red banner...">Không hiển thị được kết quả. Vui lòng thử tạo lại.</div>;
    }
    return this.props.children;
  }
}
// Wrap <ResultDisplay /> in App.tsx. Belt-and-suspenders with null-guards below.
```
Null-guard every array access in `ResultDisplay.tsx` (defense in depth even with Zod on the server): `(data.key_benefits ?? []).map(...)`, `(data.product_highlights ?? []).map(...)`, `(data.hashtags ?? []).join(' ')`, `(data.scenes ?? []).map(...)` — lines 108, 120, 130, 136, 157.

### Pattern 5: Fail-fast env + configurable PORT (D-07)
```typescript
// Source: idiomatic Node boot validation; zod optional but clean
// server/config.ts
import { z } from "zod";
const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});
export function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Missing/invalid environment variables:\n" +
      parsed.error.issues.map(i => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1); // fail-fast at boot, NOT per-request
  }
  return parsed.data;
}
```
**Important:** move `GEMINI_API_KEY` validation to boot (`loadEnv()` before `startServer`). Keep the per-request `if (!apiKey) 500` as a defensive fallback, but the primary check is fail-fast at boot per D-07. In `test` mode Zod should NOT require `GEMINI_API_KEY` (the SDK is mocked) — either set `NODE_ENV=test` to relax the check, or never call `loadEnv()` from the test path (tests import `createApp()` directly).

### Pattern 6: Vitest integration test with mocked SDK (D-11)
```typescript
// tests/api.generate.test.ts
// Source: vitest.dev/guide/mocking + supertest docs
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const mockGenerate = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(() => ({ models: { generateContent: mockGenerate } })),
  Type: new Proxy({}, { get: (_t, p) => String(p) }), // Type.OBJECT -> "OBJECT" etc.
}));

import { createApp, MODEL_ID } from "../server"; // import AFTER vi.mock (hoisted anyway)
const app = createApp();

const VALID = { candidates: [{ finishReason: "STOP" }], text: JSON.stringify({ /* full 4-channel fixture */ }) };

describe("/api/generate", () => {
  beforeEach(() => mockGenerate.mockReset());

  it("happy path returns validated JSON", async () => {
    mockGenerate.mockResolvedValue(VALID);
    const res = await request(app).post("/api/generate").send({ productInfo: "x", affiliateLink: "https://a.b" });
    expect(res.status).toBe(200);
    expect(res.body.product_analysis.product_name).toBeTruthy();
  });

  it("truncated response → error, not crash", async () => {
    mockGenerate.mockResolvedValue({ candidates: [{ finishReason: "MAX_TOKENS" }], text: "{partial" });
    const res = await request(app).post("/api/generate").send({ productInfo: "x", affiliateLink: "https://a.b" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeTruthy(); // Vietnamese message, no stack
  });

  it("model id is in the allowlist", async () => {
    const { ALLOWLIST } = await import("../src/schema/modelAllowlist"); // or read the shared const
    expect(ALLOWLIST).toContain(MODEL_ID);
  });
});
```
Because the SDK is mocked, **no `GEMINI_API_KEY` is needed in CI** (D-10). Set `test` mode so `loadEnv()` is skipped or relaxed. Set up `vitest.config.ts` with `test.environment: "node"` for the API test (the React render test, if added, needs `jsdom` + `@testing-library/react` — optional; D-11 only mandates the API tests + allowlist).

### Anti-Patterns to Avoid
- **Booting Vite/`listen()` inside the tested module** — makes CI hang/fail; export `createApp()` instead.
- **Retrying a `SAFETY`/`RECITATION`/schema failure** — deterministic; wastes a paid call and still fails.
- **Trusting `responseSchema` alone and dropping the Zod check** — schema-constrained output can still omit/rename under edge conditions; D-03 double-guard is intentional. Keep both.
- **Leaking `error.message`/stack to the client** — CONTEXT §specifics: the Vietnamese error must read like a human wrote it, no JSON/stack. Map internal reasons to friendly messages; log the detail server-side only.
- **Per-request env validation as the only check** — D-07 wants fail-fast at boot so a misconfigured deploy dies immediately, not on first user request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime validation of model output | Manual `typeof`/key-presence checks | `zod` `safeParse` | Handles nested arrays/objects, gives structured error paths, and doubles as the env validator |
| JSON-shape enforcement from the model | Regex/markdown-fence stripping heuristics | Gemini `responseSchema` + `responseMimeType` | The model constrains its own output; heuristics are brittle |
| Express handler testing harness | Hand-mocked `req`/`res` objects | `supertest` | Exercises real routing + `express.json()` parsing; less brittle |
| React crash containment | try/catch around render (impossible for children) | class `ErrorBoundary` | React only supports error boundaries via class lifecycle methods |
| Cross-platform `clean` | Shell-specific `rm -rf` | `rimraf` | Current script fails on the Windows dev box (CONCERNS) |
| Env parsing/coercion | `Number(process.env.PORT) || 3000` scattered inline | one `zod` env schema | Centralizes required-var list + coercion + fail-fast message |

**Key insight:** Every "hand-rolled" option here is exactly what created the current bugs (unguarded `JSON.parse`, prose-only schema, no tests). The phase's whole point is to replace ad-hoc trust with declared contracts (schema + Zod + tests).

## Runtime State Inventory

> This is a code-fix + tooling phase, not a rename/migration. Included briefly because D-08 touches template metadata and D-09 touches git/remote state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — app is stateless, no DB/datastore yet (DB arrives Phase 2). | none |
| Live service config | None — no external service config stored outside git. | none |
| OS-registered state | None — no scheduled tasks / pm2 / services registered. | none |
| Secrets/env vars | `GEMINI_API_KEY` read from `process.env` (`server.ts:25`); `.gitignore` excludes `.env*` except example. D-08 adds `.env.local.example`. No secret value changes. | Create `.env.local.example`; document real var name in README |
| Build artifacts | `dist/server.cjs` (esbuild output) — regenerated by `build`; no stale-name risk. AI Studio template metadata in `index.html`, `metadata.json`, `README.md`, `package.json` `"name": "react-example"`. | Clean template metadata (D-08); rewrite README env instructions |
| Git/remote state | **git IS already initialized** (`git rev-parse --is-inside-work-tree` → true), contradicting D-09's "chưa phải git repo". No GitHub remote confirmed. `bun.lock` present, no `package-lock.json`. | Verify/add GitHub remote + push; do NOT re-`git init`. Confirm which lockfile CI uses |

## Common Pitfalls

### Pitfall 1: Assuming the model id is invalid (it isn't, anymore)
**What goes wrong:** The plan hard-codes "gemini-3.7-flash is invalid, replace it" and locks an allowlist that excludes valid current ids — or picks a `gemini-2.0-*` id that was shut down 2026-06-01.
**Why it happens:** The app was scaffolded before Gemini 3.x shipped; CONCERNS.md/CONTEXT.md captured the old reality. Model availability moves fast.
**How to avoid:** Verify at build-time (this research did). Put the **verified set** in the allowlist, not one assumed id. See "Gemini Model ID" finding + Assumptions Log A1.
**Warning signs:** A `404`/`NOT_FOUND` from Gemini at first real call, or CI allowlist rejecting a model id that Google's docs list as GA.

### Pitfall 2: Non-importable server module breaks CI
**What goes wrong:** Test imports `server.ts`, which runs `startServer()` → `createViteServer()` at import time → Vite spins up / hangs / errors in CI.
**Why it happens:** Current `server.ts` calls `startServer()` at module top level (`server.ts:126`) and mixes Vite middleware into the same function.
**How to avoid:** Export `createApp()`/handler; only call `startServer()` when run as the entry (guard with `if (import.meta.url === ...)` or keep boot in a separate entry file).
**Warning signs:** Tests time out or Vite logs appear during `vitest run`.

### Pitfall 3: `response.text` is `undefined` on safety blocks
**What goes wrong:** `JSON.parse(undefined)` or `JSON.parse("")` throws with an opaque message; the D-04 finishReason check is bypassed if you read `.text` first.
**Why it happens:** On `SAFETY`/`RECITATION`, Gemini returns a candidate with no text part; `response.text` is `undefined`.
**How to avoid:** Check `candidates[0].finishReason` BEFORE reading `.text`; treat missing text as a (retryable-once) empty result. See Pattern 3.
**Warning signs:** Intermittent 500s only on certain product inputs (safety-adjacent content).

### Pitfall 4: `INTEGER` / `scene_number` schema type
**What goes wrong:** `scene_number` is `number` in `src/types.ts`; if the responseSchema uses an unsupported `INTEGER` type or the model returns `"1"` as a string, Zod rejects it.
**Why it happens:** Gemini schema `Type` support and JSON number/string coercion vary.
**How to avoid:** Use `Type.NUMBER` in the responseSchema and `z.coerce.number()` in Zod for `scene_number`; keep snake_case keys exactly matching `src/types.ts`.
**Warning signs:** Schema-validation failures isolated to the video-scenes tab.

### Pitfall 5: `propertyOrdering` / prompt+schema drift
**What goes wrong:** The prompt already embeds a full JSON example (`server.ts:54-81`). If the `responseSchema` and the prose example disagree (key names, nesting), the model gets conflicting instructions.
**Why it happens:** Two sources of truth for the shape.
**How to avoid:** Make `responseSchema` the authority; trim the prose JSON block to a short shape hint or keep it consistent to the letter. Consider `propertyOrdering` if output key order matters for readability (it does not for parsing).
**Warning signs:** Occasional missing/renamed keys despite the schema.

## Code Examples

(See Patterns 2–6 above — each carries a Source tag. The most load-bearing exact strings are: `config.responseMimeType: "application/json"` + `config.responseSchema`; `response.candidates?.[0]?.finishReason`; finishReason values `STOP`/`MAX_TOKENS`/`SAFETY`/`RECITATION`/`OTHER`; `vi.mock("@google/genai", () => ({ GoogleGenAI: vi.fn(...) }))`.)

## Gemini Model ID — Verified Finding (FIX-01, D-01) ⚠️ NEEDS USER CONFIRMATION

**Verified 2026-08-17 against live sources:**

| Model id | Status (as of 2026-08-17) | Source |
|----------|---------------------------|--------|
| `gemini-2.5-flash` | **Stable, GA — "No shutdown date announced"** | `[CITED: ai.google.dev/gemini-api/docs/deprecations]` |
| `gemini-2.5-flash-lite` | Stable, GA — no shutdown date | `[CITED: ai.google.dev/gemini-api/docs/deprecations]` |
| `gemini-3.7-flash` | **GA — current latest flash, released ~2026-08-13** | `[CITED: benchlm.ai/providers/google, verified 2026-08-15]` |
| `gemini-3.6-flash` | GA (listed as replacement for gemini-2.0-flash) | `[CITED: ai.google.dev/gemini-api/docs/deprecations]` |
| `gemini-3.5-flash` / `gemini-3.5-flash-lite` | GA | `[CITED: ai.google.dev/gemini-api/docs/models]` |
| `gemini-2.0-flash` / `gemini-2.0-flash-lite` | **Shut down 2026-06-01** — do NOT use | `[CITED: ai.google.dev/gemini-api/docs/deprecations]` |

**The material surprise:** The phase's foundational assumption — that `gemini-3.7-flash` in `server.ts:85` is a *nonexistent/invalid* id — is **no longer true**. Google shipped the Gemini 3.x family since the app was scaffolded; `gemini-3.7-flash` is now a real, current GA model. So the app may have been "broken by a not-yet-existing id" that has since become valid. Independently, D-01's proposed replacement `gemini-2.5-flash` is also currently valid and stable.

**One conflicting signal (surfaced honestly):** a Google AI Developers *forum* thread ("Gemini 2.5 Flash deprecated without warning earlier than shutdown date") claims 2.5-flash was pulled early. This is user-reported, MEDIUM/LOW confidence, and **contradicted by the authoritative deprecations doc** which lists 2.5-flash as stable with no shutdown date. Treat the official doc as source of truth; note the forum as a watch-item.

**Recommendation to planner:**
1. **Ask the user which id to pin** (quick confirmation): `gemini-2.5-flash` (D-01's choice, stable, cheaper/older-gen) vs `gemini-3.7-flash` (current latest flash, the value already in the file — pricing ~$0.75/$3.75 per M tokens). For content-marketing text at internal scale either works; 2.5-flash is the lower-cost, D-01-aligned default.
2. **Pin the chosen id in ONE exported constant** (`MODEL_ID` in `server.ts` or `src/schema/modelAllowlist.ts`).
3. **Allowlist = the verified valid set**, e.g. `["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]`, and CI asserts `MODEL_ID ∈ ALLOWLIST`. Do NOT include any `gemini-2.0-*` id (shut down). Keep the allowlist small (only ids you'd actually deploy) to keep it meaningful.
4. Add a dated comment next to the allowlist ("verified against ai.google.dev/gemini-api/docs/deprecations on 2026-08-17") so the next editor re-verifies rather than trusts.

## Structured Output & finishReason — Verified API Facts

- **Structured output:** `config.responseMimeType: "application/json"` + `config.responseSchema` (object using `Type.OBJECT/ARRAY/STRING/NUMBER` or the equivalent string literals). `Type` is exported from `@google/genai`. `[CITED: ai.google.dev/api/generate-content]` `[CITED: googleapis.github.io/js-genai]`
- **Reading text:** `response.text` (getter) aggregates text parts; **`undefined` when there is no text part** (e.g. safety block). `[CITED: googleapis.github.io/js-genai]`
- **finishReason:** `response.candidates[0].finishReason` ∈ `{ STOP, MAX_TOKENS, SAFETY, RECITATION, OTHER }`. `STOP` = normal; `MAX_TOKENS` = truncation (retryable once); `SAFETY`/`RECITATION` = deterministic block (do not retry); `OTHER` = unknown (retryable once). `[CITED: ai.google.dev/api/generate-content]`
- **Caveat:** `responseSchema` alone does not guarantee every field is present under all conditions — keep the Zod double-guard (D-03).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` SDK, `getGenerativeModel()` | `@google/genai` `GoogleGenAI` + `ai.models.generateContent({...})` | Old SDK superseded 2024–2025 | Repo already uses the new SDK — no migration needed |
| `gemini-2.0-flash*` | `gemini-2.5-flash*` / `gemini-3.x-flash*` | 2.0 shut down 2026-06-01 | Never pin a 2.0 id |
| `responseMimeType` only | `responseMimeType` + `responseSchema` | current best practice | D-02 |

**Deprecated/outdated:**
- `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-flash-001` — shut down 2026-06-01.
- `@google/generative-ai` (old SDK) — superseded by `@google/genai` (already in use here).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gemini-2.5-flash` is currently stable AND `gemini-3.7-flash` is a valid current id; D-01's pin choice is a user decision | Gemini Model ID | LOW-MED — verified against official deprecations doc + directory, but model availability moves fast and one forum post disputes 2.5-flash. Mitigate: dated allowlist comment + user confirms the pinned id |
| A2 | `Type.NUMBER` (not `INTEGER`) is the safe schema type for `scene_number`, coerced in Zod | Pattern 2 / Pitfall 4 | LOW — worst case a schema-type tweak; Zod `coerce` covers string-number drift |
| A3 | supertest 7 ships its own types (no `@types/supertest` needed) | Supporting stack | LOW — add `@types/supertest` if TS complains |
| A4 | `Type` proxy mock in the test is sufficient (SDK's `Type` used only as a value map) | Pattern 6 | LOW — if the SDK validates `Type` identity, import the real enum instead of proxying |

## Open Questions (RESOLVED)

> All three resolved this session (2026-08-17): **Q1** → user confirmed pinning `gemini-2.5-flash` (D-01); both ids kept in the allowlist. **Q2** → standardized on **Bun** (`bun.lock` is the only committed lockfile; CI uses `bun install --frozen-lockfile`). **Q3** → the `ResultDisplay` render test **is included** (Plan 00-03, jsdom + `@testing-library/react`).

1. **Which model id to pin?** — **RESOLVED:** `gemini-2.5-flash` pinned per D-01 (user-confirmed); `gemini-3.7-flash` retained in the allowlist as a verified-valid id.
   - What we know: `gemini-2.5-flash` (D-01, stable) and `gemini-3.7-flash` (current latest, already in file) are both valid.
   - What's unclear: user preference on cost vs latest-gen for internal content generation.
   - Recommendation: default to `gemini-2.5-flash` (D-01, cheaper), but surface the choice to the user in discuss/plan; put both in the allowlist.
2. **Which package manager + lockfile does CI use?**
   - What we know: `bun.lock` present, no `package-lock.json`; README says `npm install`.
   - Recommendation: standardize on Bun (lockfile exists) for CI `install`, or commit a `package-lock.json` and use npm — pick one (CONCERNS "Dependencies at Risk").
3. **Add a `ResultDisplay` render test?**
   - D-11 mandates only the API tests + allowlist. A render test (valid vs missing-field payload) would directly cover FIX-04 but needs `jsdom` + `@testing-library/react`. Recommendation: include it if cheap; otherwise ErrorBoundary + null-guards + code review satisfy FIX-04.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | D-09 (init/repo) | ✓ (already a repo) | — | — |
| Node.js | dev/build/test | ✓ (project runs) | (project baseline) | — |
| Bun | lockfile / install | ✓ (`bun.lock` present) | — | npm (README references it) |
| npm registry | package install | ✓ (queried this session) | — | — |
| GitHub remote | D-09 CI | ✗ (not confirmed) | — | Must create + push a GitHub repo (prerequisite step) |
| `GEMINI_API_KEY` | live generation (NOT CI) | n/a for CI (SDK mocked, D-10) | — | Tests mock the SDK; no key needed in CI |
| Gemini API (live) | manual end-to-end verify only | requires key at runtime | — | CI uses static allowlist, not live ping (D-10) |

**Missing dependencies with no fallback:** GitHub remote must be created/pushed for Actions to run (D-09 prerequisite). Not blocking local work.
**Missing dependencies with fallback:** none blocking — `GEMINI_API_KEY` is intentionally not needed in CI.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (+ Supertest `^7.2.2`) — NEW (none exists today) |
| Config file | none yet — add `vitest.config.ts` or a `test` block in `vite.config.ts` (Wave 0) |
| Quick run command | `bunx vitest run tests/api.generate.test.ts` (or `npm run test`) |
| Full suite command | `bunx vitest run` (add `"test": "vitest run"` to `package.json`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | model id ∈ static allowlist | unit | `vitest run -t "model id is in the allowlist"` + `node scripts/check-model-allowlist.mjs` | ❌ Wave 0 |
| FIX-02 | valid Gemini JSON → Zod passes → 200 | integration (mocked SDK) | `vitest run -t "happy path"` | ❌ Wave 0 |
| FIX-03 | truncated/malformed → error not crash | integration (mocked SDK) | `vitest run -t "truncated response"` | ❌ Wave 0 |
| FIX-03 | Zod safeParse rejects bad shape server-side | unit | `vitest run tests/schema.test.ts` (optional) | ❌ Wave 0 |
| FIX-04 | ResultDisplay renders with missing fields | render (optional, needs jsdom) | `vitest run tests/ResultDisplay.test.tsx` | ❌ Wave 0 (optional) |
| FIX-05 | `loadEnv` fails fast on missing `GEMINI_API_KEY`; PORT from env | unit | `vitest run tests/config.test.ts` | ❌ Wave 0 |
| FIX-06 | CI runs lint+test+allowlist on push/PR | CI smoke | GitHub Actions run on PR | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run <the-file-touched>` + `tsc --noEmit`
- **Per wave merge:** `vitest run` (full) + `tsc --noEmit`
- **Phase gate:** full Vitest suite green + allowlist check green + a manual live end-to-end generation with a real key (outside CI) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` (or `vite.config.ts` `test` block) with `environment: "node"` — framework config
- [ ] `tests/api.generate.test.ts` — covers FIX-02, FIX-03, FIX-01(allowlist)
- [ ] `scripts/check-model-allowlist.mjs` + `src/schema/modelAllowlist.ts` — covers FIX-01
- [ ] `tests/config.test.ts` — covers FIX-05 fail-fast
- [ ] `src/schema/generatedContent.ts` (Zod) — the validation contract under test
- [ ] Refactor `server.ts` to export `createApp()`/handler — precondition for all integration tests
- [ ] `.github/workflows/ci.yml` — covers FIX-06
- [ ] Add `"test": "vitest run"` to `package.json`
- [ ] Framework install: `bun add -d vitest supertest`

## Security Domain

> `security_enforcement: true`, ASVS L1, block_on high. This phase touches an LLM boundary + env/secrets handling, so V5 and V6/V7 apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (Phase 1) | — (auth arrives with AUTH-0x) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation & Output Encoding | **yes** | Validate `productInfo`/`affiliateLink` server-side (presence today; add length cap + URL check per CONCERNS); treat **model output as untrusted** and validate with Zod (D-03) before it reaches the client |
| V6 Cryptography | no (no crypto in this phase) | — |
| V7 Error Handling & Logging | **yes** | Return generic Vietnamese error to client; log detail server-side only; never leak `error.message`/stack (CONTEXT §specifics) |
| V14 Configuration | **yes** | `GEMINI_API_KEY` server-side only (CLAUDE.md); fail-fast boot validation (D-07); `.env*` gitignored except `.env.local.example` |

### Known Threat Patterns for {Express + Gemini LLM proxy}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via `productInfo`/`affiliateLink` interpolated into the prompt | Tampering | Cap input length (`express.json({ limit })` + per-field max), treat model output as untrusted, validate with Zod. **Full mitigation is public-ready scope; Phase 0 adds the input cap + output validation only.** |
| Malformed/oversized model output crashing the server or client | DoS / Tampering | finishReason check + guarded parse + Zod + ErrorBoundary (FIX-03/FIX-04) |
| Secret leakage (`GEMINI_API_KEY`) to client or logs | Info Disclosure | Key stays server-side (CLAUDE.md), never in client bundle, never logged; not needed in CI (D-10) |
| Cost-drain via unthrottled paid API calls | DoS | Rate limiting is **deferred (PUB-01/02)** — explicitly out of Phase 0 scope per CONTEXT §deferred; input length cap partially reduces per-call cost |

*Note: CONCERNS.md also flags the `0.0.0.0` bind + no rate limit as security issues. Both are deliberately deferred to the public-ready phase (PUB-0x). Do not expand Phase 0 scope to cover them; the `security_block_on: high` gate should treat these as accepted/deferred, documented here.*

## Sources

### Primary (HIGH confidence)
- `ai.google.dev/gemini-api/docs/deprecations` — model status (2.5-flash stable; 2.0-flash shut down 2026-06-01)
- `ai.google.dev/api/generate-content` — finishReason enum, responseSchema/responseMimeType
- `googleapis.github.io/js-genai` (js-genai release docs) — SDK `generateContent`, `response.text`
- npm registry (`npm view`) — zod 4.4.3, vitest 4.1.10, supertest 7.2.2, @vitest/coverage-v8 4.1.10, rimraf 6.1.3, @google/genai 2.17.1

### Secondary (MEDIUM confidence)
- `benchlm.ai/providers/google` (verified 2026-08-15) — `gemini-3.7-flash` current, released 2026-08-13, pricing
- `vitest.dev/guide/mocking`, `vitest.dev/api/vi` — `vi.mock` hoisting, module mocking
- Supertest usage (in-process Express testing, no `listen()`)

### Tertiary (LOW confidence — flagged for re-verification)
- `discuss.ai.google.dev` forum thread claiming 2.5-flash deprecated early — user-reported, contradicted by the official deprecations doc; watch-item only

## Metadata

**Confidence breakdown:**
- Standard stack (zod/vitest/supertest versions): HIGH — verified on npm registry this session
- Gemini API shape (responseSchema, finishReason, response.text): HIGH — official Google docs
- Model id validity: MEDIUM — verified against official deprecations doc + a directory, but availability is fast-moving and one forum signal conflicts; requires user confirmation on the pinned id (A1)
- Architecture / test approach: HIGH — grounded in the actual codebase seams (single `/api/generate` handler, Vite-inline `startServer`)
- Pitfalls: HIGH — derived from CONCERNS.md + verified API behavior

**Research date:** 2026-08-17
**Valid until:** 2026-08-31 (7-day window — Gemini model availability is fast-moving; re-verify the model id/allowlist at implementation time per FIX-01)
